package billingapi

import (
	"context"
	"time"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

// GrantSubscription creates or replaces an internal subscription.
func (i *Implementation) GrantSubscription(ctx context.Context, req *billingv1.GrantSubscriptionRequest) (*billingv1.GrantSubscriptionResponse, error) {
	if req.GetUserId() == "" || req.GetPlanSlug() == "" {
		return nil, invalidArgument("user_id and plan_slug are required")
	}
	var periodEnd *time.Time
	if ts := req.GetCurrentPeriodEnd(); ts != nil {
		t := ts.AsTime()
		periodEnd = &t
	}
	sub, err := i.svc.GrantSubscription(ctx, req.GetUserId(), req.GetPlanSlug(), periodEnd)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &billingv1.GrantSubscriptionResponse{
		SubscriptionId: sub.ID,
		PlanSlug:       sub.PlanSlug,
		Status:         sub.Status,
	}, nil
}
