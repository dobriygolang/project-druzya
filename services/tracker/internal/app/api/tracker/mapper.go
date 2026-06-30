package trackerapi

import (
	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

func userSettingsToProto(s *model.UserSettingsView) *trackerv1.UserSettings {
	if s == nil {
		return &trackerv1.UserSettings{}
	}
	return &trackerv1.UserSettings{
		GoogleCalendarSyncEnabled: s.GoogleCalendarSyncEnabled,
		GoogleCalendarConnected:   s.GoogleCalendarConnected,
	}
}
