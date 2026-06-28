package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// UpsertTemplateSection creates or updates a template section.
func (i *Implementation) UpsertTemplateSection(ctx context.Context, req *adminv1.UpsertTemplateSectionRequest) (*adminv1.UpsertTemplateSectionResponse, error) {
	var passingScore *int
	if req.PassingScore != nil {
		v := int(req.GetPassingScore())
		passingScore = &v
	}
	section, err := i.service.UpsertTemplateSection(ctx, contentadapter.UpsertTemplateSectionInput{
		ID:           optionalString(req.Id),
		TemplateID:   req.GetTemplateId(),
		SectionType:  req.GetSectionType(),
		Title:        req.GetTitle(),
		Description:  req.Description,
		Position:     int(req.GetPosition()),
		PassingScore: passingScore,
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.UpsertTemplateSectionResponse{Section: toProtoSection(*section)}, nil
}
