package adminapi

import (
	"context"

	billingadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// UpdatePlanEntitlement patches one plan entitlement row in billing DB.
func (i *Implementation) UpdatePlanEntitlement(ctx context.Context, req *adminv1.UpdatePlanEntitlementRequest) (*adminv1.UpdatePlanEntitlementResponse, error) {
	if req.GetPlanSlug() == "" || req.GetKey() == "" || req.GetSpec() == nil {
		return nil, invalidArgument("plan_slug, key and spec are required")
	}
	spec := billingadapter.PlanEntitlementSpec{
		Type:      req.GetSpec().GetType(),
		Unlimited: req.GetSpec().GetUnlimited(),
		Period:    req.GetSpec().GetPeriod(),
		Value:     req.GetSpec().GetValue(),
	}
	if req.GetSpec().Limit != nil {
		v := int(req.GetSpec().GetLimit())
		spec.Limit = &v
	}
	updated, err := i.service.UpdatePlanEntitlement(ctx, req.GetPlanSlug(), req.GetKey(), spec)
	if err != nil {
		return nil, mapServiceError(err)
	}
	outSpec := &adminv1.PlanEntitlementSpec{
		Type:      updated.Type,
		Unlimited: updated.Unlimited,
		Period:    updated.Period,
		Value:     updated.Value,
	}
	if updated.Limit != nil {
		v := int32(*updated.Limit)
		outSpec.Limit = &v
	}
	return &adminv1.UpdatePlanEntitlementResponse{
		PlanSlug: req.GetPlanSlug(),
		Key:      req.GetKey(),
		Spec:     outSpec,
	}, nil
}
