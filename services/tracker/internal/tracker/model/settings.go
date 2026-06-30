package model

import "time"

// UserSettings holds per-user tracker preferences and integration state.
type UserSettings struct {
	UserID                    string
	GoogleCalendarSyncEnabled bool
	GoogleRefreshToken        *string
	GoogleOAuthState          *string
	CreatedAt                 time.Time
	UpdatedAt                 time.Time
}

// UserSettingsView is the API-safe projection (no secrets).
type UserSettingsView struct {
	GoogleCalendarSyncEnabled bool
	GoogleCalendarConnected   bool
}

func (s *UserSettings) View() UserSettingsView {
	connected := s.GoogleRefreshToken != nil && *s.GoogleRefreshToken != ""
	return UserSettingsView{
		GoogleCalendarSyncEnabled: s.GoogleCalendarSyncEnabled,
		GoogleCalendarConnected:   connected,
	}
}
