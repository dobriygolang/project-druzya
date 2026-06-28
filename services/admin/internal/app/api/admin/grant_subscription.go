package adminapi

import (
	"context"

	billingadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// GrantSubscription grants or replaces a user subscription.
func (i *Implementation) GrantSubscription(ctx context.Context, req *adminv1.GrantSubscriptionRequest) (*adminv1.GrantSubscriptionResponse, error) {
	input := billingadapter.GrantSubscriptionInput{
		UserID:   req.GetUserId(),
		PlanSlug: req.GetPlanSlug(),
	}
	if ts := req.GetCurrentPeriodEnd(); ts != nil {
		t := ts.AsTime()
		input.CurrentPeriodEnd = &t
	}
	result, err := i.service.GrantSubscription(ctx, input)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.GrantSubscriptionResponse{
		SubscriptionId: result.SubscriptionID,
		PlanSlug:       result.PlanSlug,
		Status:         result.Status,
	}, nil
}
