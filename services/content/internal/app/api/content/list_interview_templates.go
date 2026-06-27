package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// ListInterviewTemplates returns interview templates.
func (i *Implementation) ListInterviewTemplates(
	ctx context.Context,
	req *contentv1.ListInterviewTemplatesRequest,
) (*contentv1.ListInterviewTemplatesResponse, error) {
	items, err := i.service.ListInterviewTemplates(
		ctx,
		optionalString(req.CompanyId),
		req.GetActiveOnly(),
		int(req.GetLimit()),
		int(req.GetOffset()),
	)
	if err != nil {
		return nil, mapServiceError(err)
	}

	templates := make([]*contentv1.InterviewTemplate, 0, len(items))
	for idx := range items {
		templates = append(templates, toProtoTemplate(&items[idx]))
	}
	return &contentv1.ListInterviewTemplatesResponse{Templates: templates}, nil
}
