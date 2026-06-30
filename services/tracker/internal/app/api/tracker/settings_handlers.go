package trackerapi

import (
	"context"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	trackerservice "github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/service"
)

func (i *Implementation) GetSettings(ctx context.Context, _ *trackerv1.GetSettingsRequest) (*trackerv1.GetSettingsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	settings, err := i.svc.GetSettings(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.GetSettingsResponse{Settings: userSettingsToProto(settings)}, nil
}

func (i *Implementation) UpdateSettings(ctx context.Context, req *trackerv1.UpdateSettingsRequest) (*trackerv1.UpdateSettingsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	settings, err := i.svc.UpdateSettings(ctx, userID, trackerservice.UpdateSettingsParams{
		GoogleCalendarSyncEnabled: req.GoogleCalendarSyncEnabled,
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.UpdateSettingsResponse{Settings: userSettingsToProto(settings)}, nil
}

func (i *Implementation) GetGoogleCalendarAuthURL(ctx context.Context, _ *trackerv1.GetGoogleCalendarAuthURLRequest) (*trackerv1.GetGoogleCalendarAuthURLResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	authURL, err := i.svc.GetGoogleCalendarAuthURL(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.GetGoogleCalendarAuthURLResponse{Url: authURL}, nil
}

func (i *Implementation) DisconnectGoogleCalendar(ctx context.Context, _ *trackerv1.DisconnectGoogleCalendarRequest) (*trackerv1.DisconnectGoogleCalendarResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	settings, err := i.svc.DisconnectGoogleCalendar(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.DisconnectGoogleCalendarResponse{Settings: userSettingsToProto(settings)}, nil
}
