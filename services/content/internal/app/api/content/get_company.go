package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// GetCompany returns a company by id or slug.
func (i *Implementation) GetCompany(ctx context.Context, req *contentv1.GetCompanyRequest) (*contentv1.GetCompanyResponse, error) {
	if err := requireIDOrSlug(req.GetId(), req.GetSlug()); err != nil {
		return nil, err
	}

	company, err := i.service.GetCompany(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.GetCompanyResponse{Company: toProtoCompany(company)}, nil
}
