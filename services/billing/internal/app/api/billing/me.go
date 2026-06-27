package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

// GetMe returns the authenticated user's plan, features, and usage limits.
func (i *Implementation) GetMe(ctx context.Context, _ *billingv1.GetMeRequest) (*billingv1.GetMeResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	view, err := i.svc.GetEntitlements(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoEntitlements(view), nil
}
