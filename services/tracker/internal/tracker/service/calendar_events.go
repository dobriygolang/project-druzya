package service

import (
	"context"
	"fmt"
	"time"

	googleadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/google"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

func (s *trackerService) ListGoogleCalendarEvents(
	ctx context.Context,
	userID string,
	timeMin, timeMax time.Time,
) ([]googleadapter.CalendarEvent, error) {
	if s.google == nil || !s.google.Configured() {
		return nil, fmt.Errorf("%w: google calendar not configured", model.ErrInvalidArgument)
	}
	settings, err := s.repo.GetUserSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	if !settings.GoogleCalendarSyncEnabled {
		return []googleadapter.CalendarEvent{}, nil
	}
	if settings.GoogleRefreshToken == nil || *settings.GoogleRefreshToken == "" {
		return []googleadapter.CalendarEvent{}, nil
	}
	return s.google.ListEvents(ctx, *settings.GoogleRefreshToken, timeMin, timeMax)
}
