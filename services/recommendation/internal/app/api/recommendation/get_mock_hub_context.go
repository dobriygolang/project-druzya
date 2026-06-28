package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
)

// GetMockHubContext returns mock hub progress context for the authenticated user.
func (i *Implementation) GetMockHubContext(ctx context.Context, _ *recommendationv1.GetMockHubContextRequest) (*recommendationv1.GetMockHubContextResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	hub, err := i.service.GetMockHubContext(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoMockHubContext(hub), nil
}
