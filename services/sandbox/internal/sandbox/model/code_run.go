package model

import (
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
	ID            string
	UserID        string
	Language      string
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

// IsHidden reports whether this result should be redacted in API responses.
func (t TestResult) IsHidden() bool {
	return strings.Contains(strings.ToLower(t.Name), "hidden")
}
