package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
)

// GetDashboard returns user recommendation dashboard.
func (i *Implementation) GetDashboard(ctx context.Context, _ *recommendationv1.GetDashboardRequest) (*recommendationv1.GetDashboardResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	dashboard, err := i.service.GetDashboard(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoDashboard(dashboard), nil
}
