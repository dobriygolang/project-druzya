package plan

import (
	"testing"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

func TestBuildDesiredTasks_allHaveDedupKey(t *testing.T) {
	tasks := BuildDesiredTasks(BuildDesiredInput{
		Lang:      "en",
		Readiness: 0,
		PendingRetries: []interviewadapter.RetryItem{
			{ID: "r1", TaskID: "t1"},
		},
	})
	if len(tasks) == 0 {
		t.Fatal("expected at least one desired task")
	}
	for _, task := range tasks {
		if task.DedupKey == "" {
			t.Fatalf("desired task %q missing dedup_key", task.Title)
		}
	}
}

func TestBuildDesiredTasks_mockStartWhenEmpty(t *testing.T) {
	tasks := BuildDesiredTasks(BuildDesiredInput{Lang: "en", Readiness: 0})
	found := false
	for _, task := range tasks {
		if task.DedupKey == "mock:start" {
			found = true
		}
	}
	if !found {
		t.Fatal("expected mock:start fallback task")
	}
}

func TestBuildDesiredTasks_takeMockWhenReady(t *testing.T) {
	tasks := BuildDesiredTasks(BuildDesiredInput{
		Lang:      "en",
		Readiness: 85,
	})
	found := false
	for _, task := range tasks {
		if task.DedupKey == "mock:take" {
			found = true
			if task.EpicName != EpicMock {
				t.Fatalf("take mock epic = %q", task.EpicName)
			}
		}
	}
	if !found {
		t.Fatal("expected mock:take when readiness >= 80")
	}
}

func TestBuildDesiredTasks_skipsInactiveRecs(t *testing.T) {
	recID := "rec-1"
	tasks := BuildDesiredTasks(BuildDesiredInput{
		Lang:      "en",
		Readiness: 50,
		Recommendations: []model.Recommendation{
			{ID: recID, Status: model.RecommendationStatusDismissed, Title: "x", Type: model.RecommendationTypeImproveSkill},
		},
	})
	for _, task := range tasks {
		if task.DedupKey == "rec:"+recID {
			t.Fatal("dismissed recommendation should not become a task")
		}
	}
}
