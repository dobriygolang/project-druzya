package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// GetUserEntitlements returns a user's plan and usage counters.
func (i *Implementation) GetUserEntitlements(ctx context.Context, req *adminv1.GetUserEntitlementsRequest) (*adminv1.GetUserEntitlementsResponse, error) {
	view, err := i.service.GetUserEntitlements(ctx, req.GetUserId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.GetUserEntitlementsResponse{Entitlements: toProtoUserEntitlements(view)}, nil
}
