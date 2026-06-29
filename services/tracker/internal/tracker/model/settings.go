package model

import (
	"strings"
	"time"
)

// UserSettings holds per-user tracker preferences and integration state.
type UserSettings struct {
	UserID                      string
	SmartParseEnabled           bool
	GoogleCalendarSyncEnabled   bool
	DeferredSprintEpicNames     []string
	GoogleRefreshToken          *string
	GoogleOAuthState            *string
	CreatedAt                   time.Time
	UpdatedAt                   time.Time
}

// UserSettingsView is the API-safe projection (no secrets).
type UserSettingsView struct {
	SmartParseEnabled         bool
	GoogleCalendarSyncEnabled bool
	GoogleCalendarConnected   bool
	DeferredSprintEpicNames   []string
}

func (s *UserSettings) View() UserSettingsView {
	connected := s.GoogleRefreshToken != nil && *s.GoogleRefreshToken != ""
	deferred := s.DeferredSprintEpicNames
	if deferred == nil {
		deferred = []string{}
	}
	return UserSettingsView{
		SmartParseEnabled:         s.SmartParseEnabled,
		GoogleCalendarSyncEnabled: s.GoogleCalendarSyncEnabled,
		GoogleCalendarConnected:   connected,
		DeferredSprintEpicNames:   deferred,
	}
}

// IsEpicDeferredForSprint reports whether an epic is excluded from the current sprint focus.
func IsEpicDeferredForSprint(epicName string, deferred []string) bool {
	name := strings.TrimSpace(epicName)
	if name == "" || len(deferred) == 0 {
		return false
	}
	for _, d := range deferred {
		if strings.EqualFold(strings.TrimSpace(d), name) {
			return true
		}
	}
	return false
}
