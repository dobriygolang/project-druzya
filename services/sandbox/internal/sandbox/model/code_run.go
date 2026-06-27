package model

import (
	"encoding/json"
	"strings"
	"time"
)

const (
	StatusQueued        = "queued"
	StatusRunning       = "running"
	StatusSuccess       = "success"
	StatusFailed        = "failed"
	StatusCompileError  = "compile_error"
	StatusRuntimeError  = "runtime_error"
	StatusTimeout       = "timeout"
	StatusInternalError = "internal_error"

	RunTypeSample = "sample"
	RunTypeSubmit = "submit"
	RunTypeCustom = "custom"

	LangGo         = "go"
	LangPython     = "python"
	LangJavaScript = "javascript"

	TestStatusPassed = "passed"
	TestStatusFailed = "failed"
	TestStatusError  = "error"
)

// CodeRun is a persisted code execution record.
type CodeRun struct {
	ID             string
	UserID         string
	TaskID         *string
	SessionTaskID  *string
	Language       string
	Code           string
	Stdin          string
	Status         string
	RunType        string
	Stdout         *string
	Stderr         *string
	CompileOutput  *string
	Error          *string
	ExitCode       *int
	TimeMS         *int
	MemoryKB       *int
	TestsTotal     int
	TestsPassed    int
	TestResults    []TestResult
	Runner         *string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// TestResult is one test case outcome.
type TestResult struct {
	Name           string  `json:"name"`
	Status         string  `json:"status"`
	Stdout         *string `json:"stdout,omitempty"`
	Stderr         *string `json:"stderr,omitempty"`
	ExpectedOutput *string `json:"expected_output,omitempty"`
	ActualOutput   *string `json:"actual_output,omitempty"`
	TimeMS         *int    `json:"time_ms,omitempty"`
	Error          *string `json:"error,omitempty"`
}

// TaskMetadata is parsed from content task.metadata JSON.
type TaskMetadata struct {
	StarterCode map[string]string `json:"starter_code"`
	Examples    []TestCaseMeta    `json:"examples"`
	TestCases   []TestCaseMeta    `json:"test_cases"`
	HiddenCases []TestCaseMeta    `json:"hidden_test_cases"`
	Limits      *RunLimits        `json:"limits"`
}

// TestCaseMeta describes a test from task metadata.
type TestCaseMeta struct {
	Name           string `json:"name"`
	Input          string `json:"input"`
	Output         string `json:"output"`
	ExpectedOutput string `json:"expected_output"`
	Explanation    string `json:"explanation"`
	IsHidden       bool   `json:"is_hidden"`
}

// RunLimits holds execution limits from metadata.
type RunLimits struct {
	TimeoutMS int `json:"timeout_ms"`
	MemoryMB  int `json:"memory_mb"`
}

// TaskSummary is minimal task info from content-service.
type TaskSummary struct {
	ID       string
	Type     string
	Metadata json.RawMessage
}

func (m TestCaseMeta) Expected() string {
	if m.ExpectedOutput != "" {
		return m.ExpectedOutput
	}
	return m.Output
}

func (m TestCaseMeta) DisplayName(fallback string) string {
	if m.Name != "" {
		return m.Name
	}
	return fallback
}

// IsHidden reports whether this result should be redacted in API responses.
func (t TestResult) IsHidden() bool {
	return strings.Contains(strings.ToLower(t.Name), "hidden")
}
