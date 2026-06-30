package service

import (
	"testing"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/runner"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

func TestSanitizeTestResultsRedactsHiddenFailures(t *testing.T) {
	t.Parallel()
	expected := "secret"
	actual := "wrong"
	results := sanitizeTestResults([]model.TestResult{{
		Name: "hidden test 1", Status: model.TestStatusFailed,
		ExpectedOutput: &expected, ActualOutput: &actual,
	}})
	if results[0].ExpectedOutput != nil || results[0].ActualOutput != nil {
		t.Fatalf("hidden failed test should not leak outputs")
	}
}

func TestFakeRunnerCustomRun(t *testing.T) {
	t.Parallel()
	r := runner.DefaultFakeRunner()
	res, err := r.Run(t.Context(), runner.RunRequest{Language: model.LangPython, Code: "print(1)", Stdin: "hello"})
	if err != nil {
		t.Fatal(err)
	}
	if res.Status != model.StatusSuccess || res.Stdout != "hello" {
		t.Fatalf("unexpected fake result: %+v", res)
	}
}

func TestFakeRunnerHiddenFailureRedaction(t *testing.T) {
	t.Parallel()
	r := runner.DefaultFakeRunner()
	res, err := r.Run(t.Context(), runner.RunRequest{
		Language: model.LangGo,
		Code:     "package main",
		Tests: []runner.TestCase{{
			Name: "hidden: edge", Input: "bad", ExpectedOutput: "good", IsHidden: true,
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(res.TestResults) != 1 {
		t.Fatalf("expected one test result")
	}
	if res.TestResults[0].ExpectedOutput != nil || res.TestResults[0].ActualOutput != nil {
		t.Fatalf("hidden test outputs must be redacted")
	}
}
