package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	contentadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/content"
	billingadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/events"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/runner"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/repository"
)

var (
	ErrInvalidInput    = errors.New("invalid input")
	ErrForbidden       = errors.New("forbidden")
	ErrNotFound        = repository.ErrNotFound
	ErrQuotaExceeded   = errors.New("quota exceeded")
	ErrFeatureDisabled = errors.New("feature disabled")
)

// RunCodeInput is input for RunCode use case.
type RunCodeInput struct {
	UserID        string
	TaskID        *string
	SessionTaskID *string
	Language      string
	Code          string
	Stdin         string
	RunType       string
}

// SubmitAttemptInput is input for SubmitAttemptFromCodeRun.
type SubmitAttemptInput struct {
	UserID        string
	BearerToken   string
	CodeRunID     string
	SessionTaskID string
}

// Service is sandbox domain logic.
type Service interface {
	RunCode(ctx context.Context, input RunCodeInput) (*model.CodeRun, error)
	GetCodeRun(ctx context.Context, userID, runID string) (*model.CodeRun, error)
	ListCodeRuns(ctx context.Context, userID string, taskID, sessionTaskID *string, limit int) ([]model.CodeRun, error)
	SubmitAttemptFromCodeRun(ctx context.Context, input SubmitAttemptInput) (*interviewadapter.SubmitAttemptResult, error)
	ProcessQueuedRuns(ctx context.Context, limit int) (int, error)
	FormatCode(ctx context.Context, userID, language, code string) (string, error)
}

type sandboxService struct {
	repo      *repository.Repository
	content   contentadapter.Client
	interview interviewadapter.Client
	billing   billingadapter.Client
	runner    runner.CodeRunner
	events    events.Publisher
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
	Content       contentadapter.Client
	Interview     interviewadapter.Client
	Billing       billingadapter.Client
	Runner        runner.CodeRunner
	Events        events.Publisher
	TimeoutMS     int
	MemoryMB      int
	MaxCodeBytes  int
	MaxStdinBytes int
	AsyncRuns     bool
}

// New constructs sandbox service.
func New(deps Deps) Service {
	pub := deps.Events
	if pub == nil {
		pub = events.NoopPublisher{}
	}
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
		content:   deps.Content,
		interview: deps.Interview,
		billing:   deps.Billing,
		runner:    deps.Runner,
		events:    pub,
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
	runType, err := normalizeRunType(input.RunType)
	if err != nil {
		return nil, err
	}
	if err := s.gateCodeRun(ctx, input.UserID, runType); err != nil {
		return nil, err
	}

	var meta *model.TaskMetadata
	if input.TaskID != nil && *input.TaskID != "" && s.content != nil {
		task, err := s.content.GetTask(ctx, *input.TaskID)
		if err != nil {
			return nil, fmt.Errorf("get task: %w", err)
		}
		meta, _ = contentadapter.ParseTaskMetadata(task.Metadata)
	}

	tests, timeoutMS, memoryMB := selectTests(meta, runType, s.defaults)
	now := time.Now().UTC()
	status := model.StatusRunning
	if s.asyncRuns {
		status = model.StatusQueued
	}
	run := &model.CodeRun{
		ID:            uuid.NewString(),
		UserID:        input.UserID,
		TaskID:        input.TaskID,
		SessionTaskID: input.SessionTaskID,
		Language:      lang,
		Code:          input.Code,
		Stdin:         input.Stdin,
		Status:        status,
		RunType:       runType,
		TestResults:   []model.TestResult{},
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := s.repo.Create(ctx, run); err != nil {
		return nil, err
	}

	if s.asyncRuns {
		return sanitizeRunResponse(run), nil
	}

	return s.executeRun(ctx, run, input.Stdin, tests, timeoutMS, memoryMB)
}

func (s *sandboxService) ProcessQueuedRuns(ctx context.Context, limit int) (int, error) {
	runs, err := s.repo.ClaimQueuedRuns(ctx, limit)
	if err != nil {
		return 0, err
	}
	for i := range runs {
		run := &runs[i]
		meta := s.loadTaskMetadata(ctx, run.TaskID)
		tests, timeoutMS, memoryMB := selectTests(meta, run.RunType, s.defaults)
		if _, err := s.executeRun(ctx, run, run.Stdin, tests, timeoutMS, memoryMB); err != nil {
			return i, err
		}
	}
	return len(runs), nil
}

func (s *sandboxService) loadTaskMetadata(ctx context.Context, taskID *string) *model.TaskMetadata {
	if taskID == nil || *taskID == "" || s.content == nil {
		return nil
	}
	task, err := s.content.GetTask(ctx, *taskID)
	if err != nil {
		return nil
	}
	meta, _ := contentadapter.ParseTaskMetadata(task.Metadata)
	return meta
}

func (s *sandboxService) executeRun(
	ctx context.Context,
	run *model.CodeRun,
	stdin string,
	tests []model.TestCaseMeta,
	timeoutMS, memoryMB int,
) (*model.CodeRun, error) {
	result, runErr := s.runner.Run(ctx, runner.RunRequest{
		Language:  run.Language,
		Code:      run.Code,
		Stdin:     stdin,
		Tests:     toRunnerTests(tests),
		TimeoutMS: timeoutMS,
		MemoryMB:  memoryMB,
		RunType:   run.RunType,
	})

	run.UpdatedAt = repository.TouchUpdatedAt()
	if runErr != nil {
		msg := runErr.Error()
		run.Status = model.StatusInternalError
		run.Error = &msg
		run.Runner = strPtr(s.runner.Name())
		_ = s.repo.Update(ctx, run)
		_ = s.events.CodeRunFailed(ctx, run)
		return sanitizeRunResponse(run), nil
	}

	applyRunResult(run, result)
	if err := s.repo.Update(ctx, run); err != nil {
		return nil, err
	}
	if run.Status == model.StatusSuccess {
		_ = s.events.CodeRunCompleted(ctx, run)
	} else {
		_ = s.events.CodeRunFailed(ctx, run)
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

func (s *sandboxService) ListCodeRuns(ctx context.Context, userID string, taskID, sessionTaskID *string, limit int) ([]model.CodeRun, error) {
	runs, err := s.repo.List(ctx, repository.ListFilter{
		UserID: userID, TaskID: taskID, SessionTaskID: sessionTaskID, Limit: limit,
	})
	if err != nil {
		return nil, err
	}
	for i := range runs {
		runs[i] = *sanitizeRunResponse(&runs[i])
	}
	return runs, nil
}

func (s *sandboxService) SubmitAttemptFromCodeRun(ctx context.Context, input SubmitAttemptInput) (*interviewadapter.SubmitAttemptResult, error) {
	if input.UserID == "" || input.CodeRunID == "" || input.SessionTaskID == "" {
		return nil, fmt.Errorf("user_id, code_run_id and session_task_id required: %w", ErrInvalidInput)
	}
	if input.BearerToken == "" {
		return nil, fmt.Errorf("bearer token required: %w", ErrInvalidInput)
	}
	if s.interview == nil {
		return nil, fmt.Errorf("interview client not configured")
	}

	run, err := s.repo.GetByID(ctx, input.CodeRunID)
	if err != nil {
		return nil, err
	}
	if run.UserID != input.UserID {
		return nil, ErrForbidden
	}
	if run.SessionTaskID != nil && *run.SessionTaskID != "" && *run.SessionTaskID != input.SessionTaskID {
		return nil, fmt.Errorf("session_task_id mismatch: %w", ErrInvalidInput)
	}
	// Only a successful submit-type run may be turned into an interview attempt.
	if run.RunType != model.RunTypeSubmit {
		return nil, fmt.Errorf("only submit runs can be submitted, got %q: %w", run.RunType, ErrInvalidInput)
	}
	if run.Status != model.StatusSuccess {
		return nil, fmt.Errorf("run is not successful (status %q): %w", run.Status, ErrInvalidInput)
	}

	lang := run.Language
	result, err := s.interview.SubmitAttempt(ctx, input.BearerToken, interviewadapter.SubmitAttemptInput{
		SessionTaskID: input.SessionTaskID,
		Code:          &run.Code,
		Language:      &lang,
	})
	if err != nil {
		return nil, err
	}
	_ = s.events.AttemptSubmittedFromCodeRun(ctx, run.ID, result.AttemptID)
	return result, nil
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

func normalizeRunType(runType string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(runType)) {
	case "", model.RunTypeCustom:
		return model.RunTypeCustom, nil
	case model.RunTypeSample, model.RunTypeSubmit:
		return strings.ToLower(strings.TrimSpace(runType)), nil
	default:
		return "", fmt.Errorf("unsupported run_type %q: %w", runType, ErrInvalidInput)
	}
}

func selectTests(meta *model.TaskMetadata, runType string, defaults runDefaults) ([]model.TestCaseMeta, int, int) {
	timeout := defaults.timeoutMS
	memory := defaults.memoryMB
	if meta != nil && meta.Limits != nil {
		if meta.Limits.TimeoutMS > 0 {
			timeout = meta.Limits.TimeoutMS
		}
		if meta.Limits.MemoryMB > 0 {
			memory = meta.Limits.MemoryMB
		}
	}
	if meta == nil {
		return nil, timeout, memory
	}
	switch runType {
	case model.RunTypeSample:
		return publicTests(meta), timeout, memory
	case model.RunTypeSubmit:
		return allTests(meta), timeout, memory
	default:
		return nil, timeout, memory
	}
}

func publicTests(meta *model.TaskMetadata) []model.TestCaseMeta {
	out := make([]model.TestCaseMeta, 0, len(meta.Examples)+len(meta.TestCases))
	for _, ex := range meta.Examples {
		ex.IsHidden = false
		out = append(out, ex)
	}
	for _, tc := range meta.TestCases {
		if !tc.IsHidden {
			out = append(out, tc)
		}
	}
	return out
}

func allTests(meta *model.TaskMetadata) []model.TestCaseMeta {
	out := publicTests(meta)
	for _, tc := range meta.HiddenCases {
		tc.IsHidden = true
		out = append(out, tc)
	}
	for _, tc := range meta.TestCases {
		if tc.IsHidden {
			out = append(out, tc)
		}
	}
	return out
}

func toRunnerTests(tests []model.TestCaseMeta) []runner.TestCase {
	out := make([]runner.TestCase, 0, len(tests))
	for i, tc := range tests {
		name := tc.DisplayName(fmt.Sprintf("test %d", i+1))
		if tc.IsHidden && !strings.Contains(strings.ToLower(name), "hidden") {
			name = "hidden: " + name
		}
		out = append(out, runner.TestCase{
			Name:           name,
			Input:          tc.Input,
			ExpectedOutput: tc.Expected(),
			IsHidden:       tc.IsHidden,
		})
	}
	return out
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
