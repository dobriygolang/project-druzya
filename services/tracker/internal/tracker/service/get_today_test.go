package service

import (
	"testing"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

func TestFilterTasksForSprintFocus(t *testing.T) {
	tasks := []model.Task{
		{ID: "a", EpicID: strPtr("e1")},
		{ID: "b", EpicID: strPtr("e2")},
	}
	names := map[string]string{"e1": "Retries", "e2": "Review"}
	filtered := filterTasksForSprintFocus(tasks, names, []string{"Review"})
	if len(filtered) != 1 || filtered[0].ID != "a" {
		t.Fatalf("got %+v", filtered)
	}
}

func TestFilterOpenTasks_excludesDoneAndArchived(t *testing.T) {
	tasks := []model.Task{
		{ID: "open", Title: "open"},
		{ID: "done", Title: "done", Done: true},
		{ID: "archived", Title: "archived", Metadata: map[string]any{"archived": true}},
	}
	open := filterOpenTasks(tasks)
	if len(open) != 1 || open[0].ID != "open" {
		t.Fatalf("got %d open tasks, want 1 open", len(open))
	}
}

func strPtr(s string) *string { return &s }
