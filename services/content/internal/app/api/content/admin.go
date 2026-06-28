package contentapi

import (
	"context"
	"strings"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const adminTokenHeader = "x-admin-token"

// AdminInterceptor validates admin token for ContentAdminService RPCs.
func AdminInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if !strings.Contains(info.FullMethod, "ContentAdminService/") {
			return handler(ctx, req)
		}
		if token == "" {
			return nil, status.Error(codes.Unauthenticated, "admin token not configured")
		}
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}
		vals := md.Get(adminTokenHeader)
		if len(vals) == 0 || vals[0] != token {
			return nil, status.Error(codes.Unauthenticated, "invalid admin token")
		}
		return handler(ctx, req)
	}
}

// UpsertCompany creates or updates a company (admin).
func (i *Implementation) UpsertCompany(ctx context.Context, req *contentv1.UpsertCompanyRequest) (*contentv1.UpsertCompanyResponse, error) {
	company, err := i.service.UpsertCompany(ctx, catalogmodel.Company{
		ID:          req.GetId(),
		Slug:        req.GetSlug(),
		Name:        req.GetName(),
		Description: optionalString(req.Description),
		IsActive:    req.GetIsActive(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.UpsertCompanyResponse{Company: toProtoCompany(company)}, nil
}

// UpsertTask creates or updates a task (admin).
func (i *Implementation) UpsertTask(ctx context.Context, req *contentv1.UpsertTaskRequest) (*contentv1.UpsertTaskResponse, error) {
	meta := []byte("{}")
	if req.GetMetadata() != nil {
		raw, err := req.GetMetadata().MarshalJSON()
		if err != nil {
			return nil, invalidArgument("invalid metadata")
		}
		meta = raw
	}
	var est *int
	if req.EstimatedMinutes != nil {
		v := int(req.GetEstimatedMinutes())
		est = &v
	}
	task, err := i.service.UpsertTask(ctx, catalogmodel.Task{
		ID:               req.GetId(),
		Slug:             req.GetSlug(),
		Type:             req.GetType(),
		Title:            req.GetTitle(),
		Description:      req.GetDescription(),
		Difficulty:       req.GetDifficulty(),
		EstimatedMinutes: est,
		Metadata:         meta,
		Status:           req.GetStatus(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoTask, err := toProtoTask(task)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.UpsertTaskResponse{Task: protoTask}, nil
}

// UpsertInterviewTemplate creates or updates an interview template (admin).
func (i *Implementation) UpsertInterviewTemplate(ctx context.Context, req *contentv1.UpsertInterviewTemplateRequest) (*contentv1.UpsertInterviewTemplateResponse, error) {
	passingScore := int(req.GetPassingScore())
	if passingScore <= 0 {
		passingScore = 85
	}
	template, err := i.service.UpsertInterviewTemplate(ctx, catalogmodel.InterviewTemplate{
		ID:           req.GetId(),
		CompanyID:    optionalString(req.CompanyId),
		Slug:         req.GetSlug(),
		Title:        req.GetTitle(),
		Description:  optionalString(req.Description),
		TargetRole:   optionalString(req.TargetRole),
		TargetLevel:  optionalString(req.TargetLevel),
		PassingScore: passingScore,
		IsActive:     req.GetIsActive(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.UpsertInterviewTemplateResponse{Template: toProtoTemplate(template)}, nil
}

// UpsertTemplateSection creates or updates a template section (admin).
func (i *Implementation) UpsertTemplateSection(ctx context.Context, req *contentv1.UpsertTemplateSectionRequest) (*contentv1.UpsertTemplateSectionResponse, error) {
	var passingScore *int
	if req.PassingScore != nil {
		v := int(req.GetPassingScore())
		passingScore = &v
	}
	section, err := i.service.UpsertTemplateSection(ctx, catalogmodel.TemplateSection{
		ID:           req.GetId(),
		TemplateID:   req.GetTemplateId(),
		SectionType:  req.GetSectionType(),
		Title:        req.GetTitle(),
		Description:  optionalString(req.Description),
		Position:     int(req.GetPosition()),
		PassingScore: passingScore,
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.UpsertTemplateSectionResponse{Section: toProtoSection(section)}, nil
}

// ReplaceTemplateStructure replaces all sections and task links for a template (admin).
func (i *Implementation) ReplaceTemplateStructure(ctx context.Context, req *contentv1.ReplaceTemplateStructureRequest) (*contentv1.ReplaceTemplateStructureResponse, error) {
	sections := make([]catalogmodel.TemplateSectionInput, 0, len(req.GetSections()))
	for _, item := range req.GetSections() {
		var passingScore *int
		if item.PassingScore != nil {
			v := int(item.GetPassingScore())
			passingScore = &v
		}
		sections = append(sections, catalogmodel.TemplateSectionInput{
			ID:           item.GetId(),
			SectionType:  item.GetSectionType(),
			Title:        item.GetTitle(),
			Description:  optionalString(item.Description),
			Position:     int(item.GetPosition()),
			PassingScore: passingScore,
			TaskIDs:      item.GetTaskIds(),
		})
	}
	detail, err := i.service.ReplaceTemplateStructure(ctx, req.GetTemplateId(), sections)
	if err != nil {
		return nil, mapServiceError(err)
	}
	outSections := make([]*contentv1.TemplateSection, 0, len(detail.Sections))
	for idx := range detail.Sections {
		sec := detail.Sections[idx]
		outSections = append(outSections, toProtoSection(&sec))
	}
	return &contentv1.ReplaceTemplateStructureResponse{
		Template: toProtoTemplate(detail.Template),
		Sections: outSections,
	}, nil
}
