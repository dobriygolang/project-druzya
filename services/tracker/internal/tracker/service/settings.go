package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

type UpdateSettingsParams struct {
	GoogleCalendarSyncEnabled *bool
}

func (s *trackerService) GetSettings(ctx context.Context, userID string) (*model.UserSettingsView, error) {
	settings, err := s.repo.GetUserSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	view := settings.View()
	return &view, nil
}

func (s *trackerService) UpdateSettings(ctx context.Context, userID string, in UpdateSettingsParams) (*model.UserSettingsView, error) {
	settings, err := s.repo.UpsertUserSettings(ctx, userID, in.GoogleCalendarSyncEnabled)
	if err != nil {
		return nil, err
	}
	view := settings.View()
	return &view, nil
}

func (s *trackerService) GetGoogleCalendarAuthURL(ctx context.Context, userID string) (string, error) {
	if s.google == nil || !s.google.Configured() {
		return "", fmt.Errorf("%w: google calendar not configured", model.ErrInvalidArgument)
	}
	state, err := randomState()
	if err != nil {
		return "", err
	}
	if err := s.repo.SaveGoogleOAuthState(ctx, userID, state); err != nil {
		return "", err
	}
	return s.google.AuthURL(state), nil
}

func (s *trackerService) HandleGoogleCallback(ctx context.Context, code, state string) (string, error) {
	if s.google == nil || !s.google.Configured() {
		return s.callbackRedirect("error", "not_configured"), nil
	}
	if code == "" || state == "" {
		return s.callbackRedirect("error", "missing_params"), nil
	}
	userID, err := s.repo.ConsumeGoogleOAuthState(ctx, state)
	if err != nil {
		return s.callbackRedirect("error", "invalid_state"), nil
	}
	refresh, err := s.google.ExchangeCode(ctx, code)
	if err != nil {
		return s.callbackRedirect("error", "exchange_failed"), nil
	}
	if err := s.repo.SaveGoogleRefreshToken(ctx, userID, refresh); err != nil {
		return s.callbackRedirect("error", "save_failed"), nil
	}
	return s.callbackRedirect("connected", ""), nil
}

func (s *trackerService) DisconnectGoogleCalendar(ctx context.Context, userID string) (*model.UserSettingsView, error) {
	if err := s.repo.ClearGoogleRefreshToken(ctx, userID); err != nil {
		return nil, err
	}
	disabled := false
	return s.UpdateSettings(ctx, userID, UpdateSettingsParams{GoogleCalendarSyncEnabled: &disabled})
}

func (s *trackerService) callbackRedirect(status, detail string) string {
	u, err := url.Parse(s.honeCallbackURL)
	if err != nil || u.Scheme == "" {
		u, _ = url.Parse("hone://settings")
	}
	q := u.Query()
	q.Set("google_calendar", status)
	if detail != "" {
		q.Set("detail", detail)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func randomState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
