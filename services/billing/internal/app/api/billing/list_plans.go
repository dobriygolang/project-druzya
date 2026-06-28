package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

// ListPlans returns public plan catalog for pricing UI.
func (i *Implementation) ListPlans(ctx context.Context, _ *billingv1.ListPlansRequest) (*billingv1.ListPlansResponse, error) {
	items, err := i.svc.ListPlans(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &billingv1.ListPlansResponse{Plans: make([]*billingv1.PlanCatalog, 0, len(items))}
	for _, item := range items {
		out.Plans = append(out.Plans, toProtoPlanCatalog(item, i.checkout.URLsFor(item.Slug)))
	}
	return out, nil
}
