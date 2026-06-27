package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

// RevokeSubscription cancels active subscriptions for a user.
func (i *Implementation) RevokeSubscription(ctx context.Context, req *billingv1.RevokeSubscriptionRequest) (*billingv1.RevokeSubscriptionResponse, error) {
	if req.GetUserId() == "" {
		return nil, invalidArgument("user_id is required")
	}
	if err := i.svc.RevokeSubscription(ctx, req.GetUserId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &billingv1.RevokeSubscriptionResponse{Revoked: true}, nil
}
