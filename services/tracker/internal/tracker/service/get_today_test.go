package service

import (
	"testing"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

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
