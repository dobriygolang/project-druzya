package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// UpsertInterviewTemplate creates or updates a template.
func (i *Implementation) UpsertInterviewTemplate(ctx context.Context, req *adminv1.UpsertInterviewTemplateRequest) (*adminv1.UpsertInterviewTemplateResponse, error) {
	template, err := i.service.UpsertInterviewTemplate(ctx, contentadapter.UpsertInterviewTemplateInput{
		ID:           optionalString(req.Id),
		CompanyID:    req.CompanyId,
		Slug:         req.GetSlug(),
		Title:        req.GetTitle(),
		Description:  req.Description,
		TargetRole:   req.TargetRole,
		TargetLevel:  req.TargetLevel,
		PassingScore: int(req.GetPassingScore()),
		IsActive:     req.GetIsActive(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.UpsertInterviewTemplateResponse{Template: toProtoTemplate(*template)}, nil
}
