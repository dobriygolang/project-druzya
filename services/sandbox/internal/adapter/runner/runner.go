package runner

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

// TestCase is a single stdin/stdout test for the runner.
type TestCase struct {
	Name           string
	Input          string
	ExpectedOutput string
	IsHidden       bool
}

// RunRequest is input for code execution.
type RunRequest struct {
	Language  string
	Code      string
	Stdin     string
	Tests     []TestCase
	TimeoutMS int
	MemoryMB  int
	RunType   string
}

// RunResult is execution output from a runner adapter.
type RunResult struct {
	Status        string
	Stdout        string
	Stderr        string
	CompileOutput string
	ExitCode      *int
	TimeMS        int
	MemoryKB      int
	TestResults   []model.TestResult
	Error         string
	RunnerName    string
}

// CodeRunner executes untrusted code in an isolated environment.
type CodeRunner interface {
	Run(ctx context.Context, req RunRequest) (*RunResult, error)
	Name() string
}
