package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// GetInterviewTemplateDetail returns a template with sections.
func (i *Implementation) GetInterviewTemplateDetail(ctx context.Context, req *adminv1.GetInterviewTemplateDetailRequest) (*adminv1.GetInterviewTemplateDetailResponse, error) {
	detail, err := i.service.GetInterviewTemplateDetail(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoTemplateDetail(detail), nil
}
