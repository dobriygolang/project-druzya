package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
	"github.com/sedorofeevd/project-druzya/services/tracker/pkg/classify"
)

type WorkTask struct {
	ID                   string
	Status               string
	Kind                 string
	Source               string
	Title                string
	BriefMd              string
	SkillKey             string
	DeepLink             string
	Priority             int
	CreatedAt            time.Time
	UpdatedAt            time.Time
	CompletedAt          *time.Time
	ManualKindOverride   bool
	ScheduledStart       *time.Time
	ScheduledDurationMin *int
}

type CreateWorkTaskParams struct {
	Kind     string
	Title    string
	BriefMd  string
	SkillKey string
	DeepLink string
}

func (s *trackerService) ListWorkTasks(ctx context.Context, userID string) ([]WorkTask, error) {
	if _, err := s.EnsureLearningBoard(ctx, userID); err != nil {
		return nil, err
	}
	tasks, err := s.repo.ListWorkTasksByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]WorkTask, 0, len(tasks))
	for _, t := range tasks {
		out = append(out, taskToWorkTask(&t))
	}
	return out, nil
}

func (s *trackerService) CreateWorkTask(ctx context.Context, userID string, in CreateWorkTaskParams) (*WorkTask, error) {
	board, err := s.EnsureLearningBoard(ctx, userID)
	if err != nil {
		return nil, err
	}
	meta := workTaskMetadata(in.Kind, in.BriefMd, in.SkillKey, in.DeepLink, false)
	task, err := s.repo.CreateWorkTask(ctx, board.SprintID, userID, strings.TrimSpace(in.Title), meta, "todo")
	if err != nil {
		return nil, err
	}
	if err := s.repo.InsertOutbox(ctx, model.EventTaskCreated, map[string]any{
		"user_id": userID, "task_id": task.ID, "title": task.Title,
	}); err != nil {
		return nil, err
	}
	wt := taskToWorkTask(task)
	return &wt, nil
}

func (s *trackerService) UpdateWorkTaskStatus(ctx context.Context, userID, taskID, status string) (*WorkTask, error) {
	status = strings.TrimSpace(status)
	if !validWorkStatus(status) {
		return nil, fmt.Errorf("%w: invalid status", model.ErrInvalidArgument)
	}
	before, err := s.repo.GetTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	done := status == "done"
	task, err := s.repo.PatchWorkTask(ctx, taskID, userID, repository.WorkTaskPatch{
		BoardStatus: &status,
		Done:        &done,
	})
	if err != nil {
		return nil, err
	}
	if done {
		_ = s.repo.InsertOutbox(ctx, model.EventTaskCompleted, map[string]any{
			"user_id": userID, "task_id": task.ID,
		})
	}
	s.syncGoogleCalendarWorkTaskSchedule(ctx, userID, before, task)
	wt := taskToWorkTask(task)
	return &wt, nil
}

func (s *trackerService) DeleteWorkTask(ctx context.Context, userID, taskID string) error {
	before, err := s.repo.GetTask(ctx, taskID, userID)
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
	before, err := s.repo.GetTask(ctx, taskID, userID)
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
	wt := taskToWorkTask(task)
	return &wt, nil
}

func (s *trackerService) UnscheduleWorkTask(ctx context.Context, userID, taskID string) (*WorkTask, error) {
	before, err := s.repo.GetTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	task, err := s.repo.PatchWorkTask(ctx, taskID, userID, repository.WorkTaskPatch{ClearSchedule: true})
	if err != nil {
		return nil, err
	}
	s.syncGoogleCalendarWorkTaskSchedule(ctx, userID, before, task)
	wt := taskToWorkTask(task)
	return &wt, nil
}

func (s *trackerService) UpdateWorkTaskKind(ctx context.Context, userID, taskID, kind string, manualOverride bool) (*WorkTask, error) {
	task, err := s.repo.GetTask(ctx, taskID, userID)
	if err != nil {
		return nil, err
	}
	meta := workTaskMetadata(kind, metaString(task.Metadata, "brief_md"), metaString(task.Metadata, "skill_key"), metaString(task.Metadata, "deep_link"), manualOverride)
	updated, err := s.repo.PatchWorkTask(ctx, taskID, userID, repository.WorkTaskPatch{Metadata: meta})
	if err != nil {
		return nil, err
	}
	wt := taskToWorkTask(updated)
	return &wt, nil
}

func taskToWorkTask(t *model.Task) WorkTask {
	status := t.BoardStatus
	if status == "" {
		if t.Done {
			status = "done"
		} else {
			status = "todo"
		}
	}
	kind := metaString(t.Metadata, "hone_kind")
	if kind == "" {
		kind = honeKindFromTaskKind(metaString(t.Metadata, "task_kind"))
	}
	if kind == "" {
		kind = "custom"
	}
	src := "user"
	if t.Source == model.TaskSourceRecommendation || t.Source == model.TaskSourceEnrichment {
		src = "ai"
	}
	return WorkTask{
		ID:                   t.ID,
		Status:               status,
		Kind:                 kind,
		Source:               src,
		Title:                t.Title,
		BriefMd:              metaString(t.Metadata, "brief_md"),
		SkillKey:             metaString(t.Metadata, "skill_key"),
		DeepLink:             metaString(t.Metadata, "deep_link"),
		Priority:             metaInt(t.Metadata, "priority"),
		CreatedAt:            t.CreatedAt,
		UpdatedAt:            t.UpdatedAt,
		CompletedAt:          t.CompletedAt,
		ManualKindOverride:   metaBool(t.Metadata, "manual_kind_override"),
		ScheduledStart:       t.ScheduledStart,
		ScheduledDurationMin: t.ScheduledDurationMin,
	}
}

func workTaskMetadata(kind, brief, skill, deepLink string, manualOverride bool) map[string]any {
	kind = strings.TrimSpace(kind)
	if kind == "" {
		kind = "custom"
	}
	return map[string]any{
		"hone_kind":              kind,
		"task_kind":              classifyKindFromHone(kind),
		"brief_md":               brief,
		"skill_key":              skill,
		"deep_link":              deepLink,
		"manual_kind_override":   manualOverride,
	}
}

func classifyKindFromHone(kind string) string {
	switch kind {
	case "reflection":
		return string(classify.KindLife)
	case "reading":
		return string(classify.KindLearning)
	default:
		return string(classify.KindGeneral)
	}
}

func honeKindFromTaskKind(taskKind string) string {
	switch taskKind {
	case string(classify.KindLearning):
		return "reading"
	case string(classify.KindLife):
		return "reflection"
	case string(classify.KindEvent):
		return "custom"
	default:
		return "custom"
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

func metaString(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	default:
		return fmt.Sprint(x)
	}
}

func metaBool(m map[string]any, key string) bool {
	if m == nil {
		return false
	}
	v, ok := m[key]
	if !ok {
		return false
	}
	b, ok := v.(bool)
	return ok && b
}

func metaInt(m map[string]any, key string) int {
	if m == nil {
		return 0
	}
	v, ok := m[key]
	if !ok {
		return 0
	}
	switch x := v.(type) {
	case int:
		return x
	case float64:
		return int(x)
	default:
		return 0
	}
}
