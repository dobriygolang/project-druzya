package runner

import (
	"context"
	"fmt"
	"time"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

// FakeCodeRunner simulates execution for unit tests and dev without subprocesses.
type FakeCodeRunner struct {
	Hook func(ctx context.Context, req RunRequest) (*RunResult, error)
}

func (r *FakeCodeRunner) Name() string { return "fake" }

func (r *FakeCodeRunner) Run(ctx context.Context, req RunRequest) (*RunResult, error) {
	if r.Hook != nil {
		return r.Hook(ctx, req)
	}
	start := time.Now()
	if len(req.Tests) == 0 {
		return &RunResult{
			Status:     model.StatusSuccess,
			Stdout:     req.Stdin,
			TimeMS:     int(time.Since(start).Milliseconds()),
			RunnerName: r.Name(),
		}, nil
	}

	results := make([]model.TestResult, 0, len(req.Tests))
	passed := 0
	status := model.StatusSuccess
	for i, tc := range req.Tests {
		name := tc.Name
		if name == "" {
			name = fmt.Sprintf("test %d", i+1)
		}
		tr := model.TestResult{Name: name, TimeMS: intPtr(1)}
		if outputsMatch(tc.Input, tc.ExpectedOutput) || outputsMatch("", tc.ExpectedOutput) && tc.ExpectedOutput == "" {
			tr.Status = model.TestStatusPassed
			if !tc.IsHidden {
				tr.ExpectedOutput = strPtr(tc.ExpectedOutput)
			}
			passed++
		} else {
			tr.Status = model.TestStatusFailed
			if !tc.IsHidden {
				tr.ExpectedOutput = strPtr(tc.ExpectedOutput)
				tr.ActualOutput = strPtr(tc.Input)
			}
			status = model.StatusFailed
		}
		results = append(results, tr)
	}
	_ = passed
	return &RunResult{
		Status:      status,
		TimeMS:      int(time.Since(start).Milliseconds()),
		TestResults: results,
		RunnerName:  r.Name(),
	}, nil
}

// DefaultFakeRunner returns predictable stdout-echo behavior for dev.
func DefaultFakeRunner() *FakeCodeRunner {
	return &FakeCodeRunner{
		Hook: func(_ context.Context, req RunRequest) (*RunResult, error) {
			start := time.Now()
			if len(req.Tests) == 0 {
				out := req.Stdin
				if out == "" {
					out = "fake-run-ok"
				}
				return &RunResult{
					Status: model.StatusSuccess, Stdout: out,
					TimeMS: int(time.Since(start).Milliseconds()), RunnerName: "fake",
				}, nil
			}
			results := make([]model.TestResult, 0, len(req.Tests))
			status := model.StatusSuccess
			for i, tc := range req.Tests {
				name := tc.Name
				if name == "" {
					name = fmt.Sprintf("test %d", i+1)
				}
				tr := model.TestResult{Name: name, TimeMS: intPtr(1)}
				actual := tc.Input
				if outputsMatch(actual, tc.ExpectedOutput) {
					tr.Status = model.TestStatusPassed
					if !tc.IsHidden {
						tr.ExpectedOutput = strPtr(tc.ExpectedOutput)
					}
				} else {
					tr.Status = model.TestStatusFailed
					if !tc.IsHidden {
						tr.ExpectedOutput = strPtr(tc.ExpectedOutput)
						tr.ActualOutput = strPtr(actual)
					}
					status = model.StatusFailed
				}
				results = append(results, tr)
			}
			return &RunResult{
				Status: status, TimeMS: int(time.Since(start).Milliseconds()),
				TestResults: results, RunnerName: "fake",
			}, nil
		},
	}
}
