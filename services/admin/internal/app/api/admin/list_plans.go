package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ListPlans returns billing plan catalog for admin UI.
func (i *Implementation) ListPlans(ctx context.Context, _ *adminv1.ListPlansRequest) (*adminv1.ListPlansResponse, error) {
	items, err := i.service.ListPlans(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*adminv1.PlanCatalog, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoPlan(item))
	}
	return &adminv1.ListPlansResponse{Plans: out}, nil
}
