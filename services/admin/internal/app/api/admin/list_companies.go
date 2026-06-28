package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ListCompanies returns catalog companies for admin UI.
func (i *Implementation) ListCompanies(ctx context.Context, req *adminv1.ListCompaniesRequest) (*adminv1.ListCompaniesResponse, error) {
	items, err := i.service.ListCompanies(ctx, contentadapter.ListCompaniesFilter{
		ActiveOnly: req.GetActiveOnly(),
		Limit:      int(req.GetLimit()),
		Offset:     int(req.GetOffset()),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*adminv1.Company, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoCompany(item))
	}
	return &adminv1.ListCompaniesResponse{Companies: out}, nil
}

// UpsertCompany creates or updates a company.
func (i *Implementation) UpsertCompany(ctx context.Context, req *adminv1.UpsertCompanyRequest) (*adminv1.UpsertCompanyResponse, error) {
	company, err := i.service.UpsertCompany(ctx, contentadapter.UpsertCompanyInput{
		ID:          optionalString(req.Id),
		Slug:        req.GetSlug(),
		Name:        req.GetName(),
		Description: req.Description,
		IsActive:    req.GetIsActive(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.UpsertCompanyResponse{Company: toProtoCompany(*company)}, nil
}
