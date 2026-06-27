package service

import (
	"testing"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/runner"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

func TestSelectTestsSampleExcludesHidden(t *testing.T) {
	t.Parallel()
	meta := &model.TaskMetadata{
		Examples: []model.TestCaseMeta{{Name: "example", Input: "1", Output: "1"}},
		TestCases: []model.TestCaseMeta{
			{Name: "public", Input: "2", ExpectedOutput: "2"},
			{Name: "hidden public flag", Input: "3", ExpectedOutput: "3", IsHidden: true},
		},
		HiddenCases: []model.TestCaseMeta{{Name: "hidden case", Input: "4", ExpectedOutput: "4"}},
	}
	tests, _, _ := selectTests(meta, model.RunTypeSample, runDefaults{timeoutMS: 1000, memoryMB: 64})
	if len(tests) != 2 {
		t.Fatalf("expected 2 public tests, got %d", len(tests))
	}
}

func TestSelectTestsSubmitIncludesHidden(t *testing.T) {
	t.Parallel()
	meta := &model.TaskMetadata{
		TestCases:   []model.TestCaseMeta{{Name: "public", Input: "1", ExpectedOutput: "1"}},
		HiddenCases: []model.TestCaseMeta{{Name: "hidden case", Input: "2", ExpectedOutput: "2"}},
	}
	tests, _, _ := selectTests(meta, model.RunTypeSubmit, runDefaults{timeoutMS: 1000, memoryMB: 64})
	if len(tests) != 2 {
		t.Fatalf("expected 2 tests including hidden, got %d", len(tests))
	}
}

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
