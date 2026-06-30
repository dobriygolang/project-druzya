package service

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
)

func (s *trackerService) syncGoogleCalendarWorkTaskSchedule(ctx context.Context, userID string, before, after *model.WorkTask) {
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
	eventID := ""
	if after.GoogleEventID != nil {
		eventID = *after.GoogleEventID
	}

	if after.ArchivedAt != nil || after.Status == "done" {
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
			_, _ = s.repo.PatchWorkTask(ctx, after.ID, userID, repository.WorkTaskPatch{ClearGoogleEventID: true})
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
		_, _ = s.repo.PatchWorkTask(ctx, after.ID, userID, repository.WorkTaskPatch{GoogleEventID: &id})
		return
	}

	titleChanged := before == nil || before.Title != after.Title
	scheduleChanged := before == nil || !workTaskScheduleEqual(before, after)
	if titleChanged || scheduleChanged {
		_ = s.google.UpdateEventFromSchedule(ctx, token, eventID, after.Title, start, durationMin)
	}
}

func workTaskScheduleEqual(a, b *model.WorkTask) bool {
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
