package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// RevokeSubscription cancels active subscriptions for a user.
func (i *Implementation) RevokeSubscription(ctx context.Context, req *adminv1.RevokeSubscriptionRequest) (*adminv1.RevokeSubscriptionResponse, error) {
	revoked, err := i.service.RevokeSubscription(ctx, req.GetUserId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.RevokeSubscriptionResponse{Revoked: revoked}, nil
}
