package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	billingadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/runner"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/repository"
)

var (
	ErrInvalidInput  = errors.New("invalid input")
	ErrForbidden     = errors.New("forbidden")
	ErrNotFound      = repository.ErrNotFound
	ErrQuotaExceeded = errors.New("quota exceeded")
)

// RunCodeInput is input for RunCode use case.
type RunCodeInput struct {
	UserID   string
	Language string
	Code     string
	Stdin    string
}

// Service is sandbox domain logic.
type Service interface {
	RunCode(ctx context.Context, input RunCodeInput) (*model.CodeRun, error)
	GetCodeRun(ctx context.Context, userID, runID string) (*model.CodeRun, error)
	ProcessQueuedRuns(ctx context.Context, limit int) (int, error)
	FormatCode(ctx context.Context, userID, language, code string) (string, error)
}

type sandboxService struct {
	repo      *repository.Repository
	billing   billingadapter.Client
	runner    runner.CodeRunner
	defaults  runDefaults
	limits    runLimits
	asyncRuns bool
}

type runDefaults struct {
	timeoutMS int
	memoryMB  int
}

type runLimits struct {
	maxCodeBytes  int
	maxStdinBytes int
}

// Deps holds service dependencies.
type Deps struct {
	Repo          *repository.Repository
	Billing       billingadapter.Client
	Runner        runner.CodeRunner
	TimeoutMS     int
	MemoryMB      int
	MaxCodeBytes  int
	MaxStdinBytes int
	AsyncRuns     bool
}

// New constructs sandbox service.
func New(deps Deps) Service {
	timeout := deps.TimeoutMS
	if timeout <= 0 {
		timeout = 2000
	}
	mem := deps.MemoryMB
	if mem <= 0 {
		mem = 128
	}
	maxCode := deps.MaxCodeBytes
	if maxCode <= 0 {
		maxCode = 131072
	}
	maxStdin := deps.MaxStdinBytes
	if maxStdin <= 0 {
		maxStdin = 65536
	}
	return &sandboxService{
		repo:      deps.Repo,
		billing:   deps.Billing,
		runner:    deps.Runner,
		defaults:  runDefaults{timeoutMS: timeout, memoryMB: mem},
		limits:    runLimits{maxCodeBytes: maxCode, maxStdinBytes: maxStdin},
		asyncRuns: deps.AsyncRuns,
	}
}

func (s *sandboxService) RunCode(ctx context.Context, input RunCodeInput) (*model.CodeRun, error) {
	if input.UserID == "" || input.Code == "" {
		return nil, fmt.Errorf("user_id and code required: %w", ErrInvalidInput)
	}
	if len(input.Code) > s.limits.maxCodeBytes {
		return nil, fmt.Errorf("code exceeds %d bytes: %w", s.limits.maxCodeBytes, ErrInvalidInput)
	}
	if len(input.Stdin) > s.limits.maxStdinBytes {
		return nil, fmt.Errorf("stdin exceeds %d bytes: %w", s.limits.maxStdinBytes, ErrInvalidInput)
	}
	lang, err := normalizeLanguage(input.Language)
	if err != nil {
		return nil, err
	}
	if err := s.gateCodeRun(ctx, input.UserID); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	status := model.StatusRunning
	if s.asyncRuns {
		status = model.StatusQueued
	}
	run := &model.CodeRun{
		ID:          uuid.NewString(),
		UserID:      input.UserID,
		Language:    lang,
		Code:        input.Code,
		Stdin:       input.Stdin,
		Status:      status,
		RunType:     model.RunTypeCustom,
		TestResults: []model.TestResult{},
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := s.repo.Create(ctx, run); err != nil {
		return nil, err
	}

	if s.asyncRuns {
		return sanitizeRunResponse(run), nil
	}

	return s.executeRun(ctx, run, input.Stdin)
}

func (s *sandboxService) ProcessQueuedRuns(ctx context.Context, limit int) (int, error) {
	runs, err := s.repo.ClaimQueuedRuns(ctx, limit)
	if err != nil {
		return 0, err
	}
	for i := range runs {
		run := &runs[i]
		if _, err := s.executeRun(ctx, run, run.Stdin); err != nil {
			return i, err
		}
	}
	return len(runs), nil
}

func (s *sandboxService) executeRun(ctx context.Context, run *model.CodeRun, stdin string) (*model.CodeRun, error) {
	result, runErr := s.runner.Run(ctx, runner.RunRequest{
		Language:  run.Language,
		Code:      run.Code,
		Stdin:     stdin,
		TimeoutMS: s.defaults.timeoutMS,
		MemoryMB:  s.defaults.memoryMB,
		RunType:   model.RunTypeCustom,
	})

	run.UpdatedAt = repository.TouchUpdatedAt()
	if runErr != nil {
		msg := runErr.Error()
		run.Status = model.StatusInternalError
		run.Error = &msg
		run.Runner = strPtr(s.runner.Name())
		_ = s.repo.Update(ctx, run)
		return sanitizeRunResponse(run), nil
	}

	applyRunResult(run, result)
	if err := s.repo.Update(ctx, run); err != nil {
		return nil, err
	}
	return sanitizeRunResponse(run), nil
}

func (s *sandboxService) GetCodeRun(ctx context.Context, userID, runID string) (*model.CodeRun, error) {
	run, err := s.repo.GetByID(ctx, runID)
	if err != nil {
		return nil, err
	}
	if run.UserID != userID {
		return nil, ErrForbidden
	}
	return sanitizeRunResponse(run), nil
}

func normalizeLanguage(lang string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(lang)) {
	case model.LangGo, "golang":
		return model.LangGo, nil
	case model.LangPython, "py":
		return model.LangPython, nil
	case model.LangJavaScript, "js", "node":
		return model.LangJavaScript, nil
	default:
		return "", fmt.Errorf("unsupported language %q: %w", lang, ErrInvalidInput)
	}
}

func applyRunResult(run *model.CodeRun, result *runner.RunResult) {
	run.Status = result.Status
	if result.Stdout != "" {
		run.Stdout = &result.Stdout
	}
	if result.Stderr != "" {
		run.Stderr = &result.Stderr
	}
	if result.CompileOutput != "" {
		run.CompileOutput = &result.CompileOutput
	}
	if result.Error != "" {
		run.Error = &result.Error
	}
	run.ExitCode = result.ExitCode
	if result.TimeMS > 0 {
		run.TimeMS = &result.TimeMS
	}
	if result.MemoryKB > 0 {
		run.MemoryKB = &result.MemoryKB
	}
	run.Runner = strPtr(result.RunnerName)
	run.TestResults = sanitizeTestResults(result.TestResults)
	run.TestsTotal = len(run.TestResults)
	run.TestsPassed = countPassed(run.TestResults)
}

func sanitizeTestResults(results []model.TestResult) []model.TestResult {
	if results == nil {
		return []model.TestResult{}
	}
	out := make([]model.TestResult, len(results))
	copy(out, results)
	for i := range out {
		if out[i].Status == model.TestStatusFailed && out[i].IsHidden() {
			out[i].ExpectedOutput = nil
			out[i].ActualOutput = nil
			out[i].Stdout = nil
		}
	}
	return out
}

func sanitizeRunResponse(run *model.CodeRun) *model.CodeRun {
	if run == nil {
		return nil
	}
	out := *run
	out.TestResults = sanitizeTestResults(run.TestResults)
	return &out
}

func countPassed(results []model.TestResult) int {
	n := 0
	for _, tr := range results {
		if tr.Status == model.TestStatusPassed {
			n++
		}
	}
	return n
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (s *sandboxService) FormatCode(ctx context.Context, userID, language, code string) (string, error) {
	if userID == "" || strings.TrimSpace(code) == "" {
		return "", fmt.Errorf("user_id and code required: %w", ErrInvalidInput)
	}
	if len(code) > s.limits.maxCodeBytes {
		return "", fmt.Errorf("code exceeds %d bytes: %w", s.limits.maxCodeBytes, ErrInvalidInput)
	}
	lang, err := normalizeLanguage(language)
	if err != nil {
		return "", err
	}
	if lang != model.LangGo {
		return "", fmt.Errorf("format supported only for go: %w", ErrInvalidInput)
	}
	formatted, err := s.runner.Format(ctx, lang, code)
	if err != nil {
		return "", fmt.Errorf("%s: %w", err.Error(), ErrInvalidInput)
	}
	return formatted, nil
}
