package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// ListCompanies returns catalog companies.
func (i *Implementation) ListCompanies(ctx context.Context, req *contentv1.ListCompaniesRequest) (*contentv1.ListCompaniesResponse, error) {
	items, err := i.service.ListCompanies(ctx, req.GetActiveOnly(), int(req.GetLimit()), int(req.GetOffset()))
	if err != nil {
		return nil, mapServiceError(err)
	}

	companies := make([]*contentv1.Company, 0, len(items))
	for idx := range items {
		companies = append(companies, toProtoCompany(&items[idx]))
	}
	return &contentv1.ListCompaniesResponse{Companies: companies}, nil
}
