package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

// GetEntitlements returns entitlements for a user (internal).
func (i *Implementation) GetEntitlements(ctx context.Context, req *billingv1.GetEntitlementsRequest) (*billingv1.GetEntitlementsResponse, error) {
	if req.GetUserId() == "" {
		return nil, invalidArgument("user_id is required")
	}
	view, err := i.svc.GetEntitlements(ctx, req.GetUserId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &billingv1.GetEntitlementsResponse{Entitlements: toProtoEntitlements(view)}, nil
}
