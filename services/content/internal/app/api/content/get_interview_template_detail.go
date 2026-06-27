package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// GetInterviewTemplateDetail returns a template with ordered sections and task ids.
func (i *Implementation) GetInterviewTemplateDetail(
	ctx context.Context,
	req *contentv1.GetInterviewTemplateDetailRequest,
) (*contentv1.GetInterviewTemplateDetailResponse, error) {
	if err := requireIDOrSlug(req.GetId(), req.GetSlug()); err != nil {
		return nil, err
	}

	detail, err := i.service.GetInterviewTemplateDetail(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoTemplateDetail(detail), nil
}
