package service

import (
	"context"
	"errors"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
	"github.com/sedorofeevd/project-druzya/services/tracker/pkg/classify"
)

func (s *trackerService) syncGoogleCalendarOnChange(ctx context.Context, userID string, before, after *model.Task) {
	if s.google == nil || !s.google.Configured() || after == nil {
		return
	}
	settings, err := s.repo.GetUserSettings(ctx, userID)
	if err != nil || !settings.GoogleCalendarSyncEnabled {
		return
	}
	if settings.GoogleRefreshToken == nil || *settings.GoogleRefreshToken == "" {
		return
	}
	token := *settings.GoogleRefreshToken
	beforeKind := taskKind(before)
	afterKind := taskKind(after)
	eventID, _ := after.Metadata["google_event_id"].(string)

	if after.Done && (before == nil || !before.Done) && eventID != "" {
		_ = s.google.DeleteEvent(ctx, token, eventID)
		return
	}
	if after.Done {
		return
	}

	if afterKind != classify.KindEvent {
		if beforeKind == classify.KindEvent && eventID != "" {
			_ = s.google.DeleteEvent(ctx, token, eventID)
		}
		return
	}

	if eventID == "" {
		id, err := s.google.CreateEventFromTask(ctx, token, after.Title, after.Metadata)
		if err != nil || id == "" {
			return
		}
		if updated, err := s.repo.PatchTaskMetadata(ctx, after.ID, userID, map[string]any{"google_event_id": id}); err == nil {
			after.Metadata = updated.Metadata
		}
		return
	}

	titleChanged := before == nil || before.Title != after.Title
	metaChanged := before == nil || !metadataEqualEventFields(before.Metadata, after.Metadata)
	if titleChanged || metaChanged {
		_ = s.google.UpdateEventFromTask(ctx, token, eventID, after.Title, after.Metadata)
	}
}

func (s *trackerService) syncGoogleCalendarWorkTaskSchedule(ctx context.Context, userID string, before, after *model.Task) {
	if s.google == nil || !s.google.Configured() || after == nil {
		return
	}
	settings, err := s.repo.GetUserSettings(ctx, userID)
	if err != nil || !settings.GoogleCalendarSyncEnabled {
		return
	}
	if settings.GoogleRefreshToken == nil || *settings.GoogleRefreshToken == "" {
		return
	}
	token := *settings.GoogleRefreshToken
	eventID, _ := after.Metadata["google_event_id"].(string)

	if after.ArchivedAt != nil || after.Done {
		if eventID != "" {
			_ = s.google.DeleteEvent(ctx, token, eventID)
		}
		return
	}

	hasSchedule := after.ScheduledStart != nil && after.ScheduledDurationMin != nil && *after.ScheduledDurationMin > 0
	hadSchedule := before != nil && before.ScheduledStart != nil && before.ScheduledDurationMin != nil && *before.ScheduledDurationMin > 0

	if !hasSchedule {
		if hadSchedule && eventID != "" {
			_ = s.google.DeleteEvent(ctx, token, eventID)
		}
		return
	}

	start := *after.ScheduledStart
	durationMin := *after.ScheduledDurationMin

	if eventID == "" {
		id, err := s.google.CreateEventFromSchedule(ctx, token, after.Title, start, durationMin)
		if err != nil || id == "" {
			return
		}
		if updated, err := s.repo.PatchTaskMetadata(ctx, after.ID, userID, map[string]any{"google_event_id": id}); err == nil {
			after.Metadata = updated.Metadata
		}
		return
	}

	titleChanged := before == nil || before.Title != after.Title
	scheduleChanged := before == nil || !workTaskScheduleEqual(before, after)
	if titleChanged || scheduleChanged {
		_ = s.google.UpdateEventFromSchedule(ctx, token, eventID, after.Title, start, durationMin)
	}
}

func workTaskScheduleEqual(a, b *model.Task) bool {
	if a == nil || b == nil {
		return a == b
	}
	if a.ScheduledStart == nil || b.ScheduledStart == nil {
		return a.ScheduledStart == b.ScheduledStart
	}
	if !a.ScheduledStart.Equal(*b.ScheduledStart) {
		return false
	}
	av, bv := 0, 0
	if a.ScheduledDurationMin != nil {
		av = *a.ScheduledDurationMin
	}
	if b.ScheduledDurationMin != nil {
		bv = *b.ScheduledDurationMin
	}
	return av == bv
}

func taskKind(t *model.Task) string {
	if t == nil || t.Metadata == nil {
		return ""
	}
	k, _ := t.Metadata["task_kind"].(string)
	return k
}

func metadataEqualEventFields(a, b map[string]any) bool {
	if a == nil && b == nil {
		return true
	}
	for _, key := range []string{"event_time", "event_date"} {
		av, _ := a[key].(string)
		bv, _ := b[key].(string)
		if av != bv {
			return false
		}
	}
	return true
}

func (s *trackerService) maybeAssignEpicFromHint(ctx context.Context, userID string, task *model.Task) (*model.Task, error) {
	if task == nil || task.EpicID != nil {
		return task, nil
	}
	hint := epicHintFromMeta(task.Metadata)
	if hint == "" {
		return task, nil
	}
	sprint, err := s.getSprintForUser(ctx, task.SprintID, userID)
	if err != nil {
		return task, nil
	}
	epicID, err := s.ensureEpicID(ctx, sprint.ProjectID, hint)
	if err != nil || epicID == nil {
		return task, err
	}
	updated, err := s.repo.UpdateTask(ctx, task.ID, userID, repository.TaskPatch{EpicID: epicID})
	if err != nil {
		return task, err
	}
	return updated, nil
}

func (s *trackerService) ensureEpicID(ctx context.Context, projectID, name string) (*string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, nil
	}
	epic, err := s.repo.FindEpicByName(ctx, projectID, name)
	if errors.Is(err, repository.ErrNotFound) {
		created, err := s.repo.CreateEpic(ctx, projectID, name)
		if err != nil {
			return nil, err
		}
		id := created.ID
		return &id, nil
	}
	if err != nil {
		return nil, err
	}
	id := epic.ID
	return &id, nil
}

func epicHintFromMeta(meta map[string]any) string {
	if meta == nil {
		return ""
	}
	if hint, ok := meta["epic_hint"].(string); ok && strings.TrimSpace(hint) != "" {
		return strings.TrimSpace(hint)
	}
	if book, ok := meta["book"].(string); ok && strings.TrimSpace(book) != "" {
		return strings.TrimSpace(book)
	}
	return ""
}
