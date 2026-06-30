package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
)

type WorkTask struct {
	ID                   string
	Status               string
	Kind                 string
	Title                string
	CreatedAt            time.Time
	UpdatedAt            time.Time
	CompletedAt          *time.Time
	ScheduledStart       *time.Time
	ScheduledDurationMin *int
	GoogleEventID        string
}

type CreateWorkTaskParams struct {
	Kind  string
	Title string
}

func (s *trackerService) ListWorkTasks(ctx context.Context, userID string) ([]WorkTask, error) {
	tasks, err := s.repo.ListWorkTasksByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]WorkTask, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, workTaskFromModel(&t))
	}
	return out, nil
}

func (s *trackerService) CreateWorkTask(ctx context.Context, userID string, in CreateWorkTaskParams) (*WorkTask, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, fmt.Errorf("%w: title required", model.ErrInvalidArgument)
	}
	kind := strings.TrimSpace(in.Kind)
	if kind == "" {
		kind = "custom"
	}
	task, err := s.repo.CreateWorkTask(ctx, userID, kind, title, "todo")
	if err != nil {
		return nil, err
	}
	wt := workTaskFromModel(task)
	return &wt, nil
}

func (s *trackerService) UpdateWorkTaskStatus(ctx context.Context, userID, taskID, status string) (*WorkTask, error) {
	status = strings.TrimSpace(status)
	if !validWorkStatus(status) {
		return nil, fmt.Errorf("%w: invalid status", model.ErrInvalidArgument)
	}
	before, err := s.repo.GetWorkTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	done := status == "done"
	task, err := s.repo.PatchWorkTask(ctx, taskID, userID, repository.WorkTaskPatch{
		Status: &status,
		Done:   &done,
	})
	if err != nil {
		return nil, err
	}
	s.syncGoogleCalendarWorkTaskSchedule(ctx, userID, before, task)
	wt := workTaskFromModel(task)
	return &wt, nil
}

func (s *trackerService) DeleteWorkTask(ctx context.Context, userID, taskID string) error {
	before, err := s.repo.GetWorkTask(ctx, taskID, userID)
	if err != nil {
		return err
	}
	task, err := s.repo.PatchWorkTask(ctx, taskID, userID, repository.WorkTaskPatch{Archived: true})
	if err != nil {
		return err
	}
	s.syncGoogleCalendarWorkTaskSchedule(ctx, userID, before, task)
	return nil
}

func (s *trackerService) ScheduleWorkTask(ctx context.Context, userID, taskID, startISO string, durationMin int) (*WorkTask, error) {
	if durationMin < 15 || durationMin > 480 {
		return nil, fmt.Errorf("%w: duration_min must be 15..480", model.ErrInvalidArgument)
	}
	start, err := time.Parse(time.RFC3339, startISO)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid scheduled_start", model.ErrInvalidArgument)
	}
	before, err := s.repo.GetWorkTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	task, err := s.repo.PatchWorkTask(ctx, taskID, userID, repository.WorkTaskPatch{
		ScheduledStart:       &start,
		ScheduledDurationMin: &durationMin,
	})
	if err != nil {
		return nil, err
	}
	s.syncGoogleCalendarWorkTaskSchedule(ctx, userID, before, task)
	wt := workTaskFromModel(task)
	return &wt, nil
}

func (s *trackerService) UnscheduleWorkTask(ctx context.Context, userID, taskID string) (*WorkTask, error) {
	before, err := s.repo.GetWorkTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	task, err := s.repo.PatchWorkTask(ctx, taskID, userID, repository.WorkTaskPatch{ClearSchedule: true})
	if err != nil {
		return nil, err
	}
	s.syncGoogleCalendarWorkTaskSchedule(ctx, userID, before, task)
	wt := workTaskFromModel(task)
	return &wt, nil
}

func workTaskFromModel(t *model.WorkTask) WorkTask {
	googleEventID := ""
	if t.GoogleEventID != nil {
		googleEventID = *t.GoogleEventID
	}
	return WorkTask{
		ID:                   t.ID,
		Status:               t.Status,
		Kind:                 t.Kind,
		Title:                t.Title,
		CreatedAt:            t.CreatedAt,
		UpdatedAt:            t.UpdatedAt,
		CompletedAt:          t.CompletedAt,
		ScheduledStart:       t.ScheduledStart,
		ScheduledDurationMin: t.ScheduledDurationMin,
		GoogleEventID:        googleEventID,
	}
}

func validWorkStatus(s string) bool {
	switch s {
	case "todo", "in_progress", "in_review", "done", "dismissed":
		return true
	default:
		return false
	}
}
