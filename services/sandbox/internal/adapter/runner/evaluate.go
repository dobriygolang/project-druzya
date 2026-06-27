package runner

import (
	"context"
	"fmt"
	"time"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

type onceRunFunc func(ctx context.Context, req RunRequest, stdin, testName string) (*RunResult, error)

func runWithTests(ctx context.Context, req RunRequest, runnerName string, once onceRunFunc) (*RunResult, error) {
	start := time.Now()
	if len(req.Tests) == 0 {
		res, err := once(ctx, req, req.Stdin, "")
		if err != nil {
			return nil, err
		}
		res.TimeMS = int(time.Since(start).Milliseconds())
		res.RunnerName = runnerName
		return res, nil
	}

	results := make([]model.TestResult, 0, len(req.Tests))
	var lastStdout, lastStderr string
	overallStatus := model.StatusSuccess

	for i, tc := range req.Tests {
		one, err := once(ctx, req, tc.Input, tc.Name)
		if err != nil {
			return nil, err
		}
		lastStdout = one.Stdout
		lastStderr = one.Stderr

		tr := model.TestResult{
			Name:   tc.Name,
			Stdout: strPtr(one.Stdout),
			Stderr: strPtr(one.Stderr),
			TimeMS: intPtr(one.TimeMS),
		}
		switch {
		case one.Status == model.StatusTimeout:
			tr.Status = model.TestStatusError
			tr.Error = strPtr("timeout")
			overallStatus = model.StatusTimeout
		case one.Status == model.StatusCompileError:
			tr.Status = model.TestStatusError
			tr.Error = strPtr(one.CompileOutput)
			overallStatus = model.StatusCompileError
		case outputsMatch(one.Stdout, tc.ExpectedOutput):
			tr.Status = model.TestStatusPassed
			if !tc.IsHidden {
				tr.ExpectedOutput = strPtr(tc.ExpectedOutput)
			}
		default:
			tr.Status = model.TestStatusFailed
			if !tc.IsHidden {
				tr.ExpectedOutput = strPtr(tc.ExpectedOutput)
				tr.ActualOutput = strPtr(one.Stdout)
			}
			if overallStatus == model.StatusSuccess {
				overallStatus = model.StatusFailed
			}
		}
		if tr.Name == "" {
			tr.Name = fmt.Sprintf("test %d", i+1)
		}
		results = append(results, tr)
	}

	return &RunResult{
		Status:      overallStatus,
		Stdout:      lastStdout,
		Stderr:      lastStderr,
		TimeMS:      int(time.Since(start).Milliseconds()),
		TestResults: results,
		RunnerName:  runnerName,
	}, nil
}
