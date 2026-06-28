package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ListInterviewTemplates returns catalog templates for admin UI.
func (i *Implementation) ListInterviewTemplates(ctx context.Context, req *adminv1.ListInterviewTemplatesRequest) (*adminv1.ListInterviewTemplatesResponse, error) {
	filter := contentadapter.ListInterviewTemplatesFilter{
		ActiveOnly: req.GetActiveOnly(),
		Limit:      int(req.GetLimit()),
		Offset:     int(req.GetOffset()),
	}
	if req.CompanyId != nil {
		filter.CompanyID = req.CompanyId
	}
	items, err := i.service.ListInterviewTemplates(ctx, filter)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*adminv1.InterviewTemplate, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoTemplate(item))
	}
	return &adminv1.ListInterviewTemplatesResponse{Templates: out}, nil
}
