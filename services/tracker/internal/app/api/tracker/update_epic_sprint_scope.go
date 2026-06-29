package trackerapi

import (
	"context"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
)

func (i *Implementation) UpdateEpicSprintScope(ctx context.Context, req *trackerv1.UpdateEpicSprintScopeRequest) (*trackerv1.UpdateSettingsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}
	settings, err := i.svc.UpdateEpicSprintScope(ctx, userID, req.GetId(), req.GetDeferred())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &trackerv1.UpdateSettingsResponse{Settings: userSettingsToProto(settings)}, nil
}
