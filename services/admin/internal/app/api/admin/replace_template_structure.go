package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ReplaceTemplateStructure replaces all sections and task links for a template.
func (i *Implementation) ReplaceTemplateStructure(ctx context.Context, req *adminv1.ReplaceTemplateStructureRequest) (*adminv1.ReplaceTemplateStructureResponse, error) {
	sections := make([]contentadapter.TemplateStructureSectionInput, 0, len(req.GetSections()))
	for _, item := range req.GetSections() {
		var passingScore *int
		if item.PassingScore != nil {
			v := int(item.GetPassingScore())
			passingScore = &v
		}
		sections = append(sections, contentadapter.TemplateStructureSectionInput{
			ID:           optionalString(item.Id),
			SectionType:  item.GetSectionType(),
			Title:        item.GetTitle(),
			Description:  item.Description,
			Position:     int(item.GetPosition()),
			PassingScore: passingScore,
			TaskIDs:      item.GetTaskIds(),
		})
	}
	detail, err := i.service.ReplaceTemplateStructure(ctx, req.GetTemplateId(), sections)
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoDetail := toProtoTemplateDetail(detail)
	return &adminv1.ReplaceTemplateStructureResponse{
		Template: protoDetail.GetTemplate(),
		Sections: protoDetail.GetSections(),
	}, nil
}
