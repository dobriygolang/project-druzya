package contentapi

import (
	"encoding/json"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	catalogservice "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/service"
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoCompany(c *catalogmodel.Company) *contentv1.Company {
	if c == nil {
		return nil
	}
	return &contentv1.Company{
		Id:          c.ID,
		Slug:        c.Slug,
		Name:        c.Name,
		Description: c.Description,
		IsActive:    c.IsActive,
		CreatedAt:   timestamppb.New(c.CreatedAt),
		UpdatedAt:   timestamppb.New(c.UpdatedAt),
	}
}

func toProtoTemplate(t *catalogmodel.InterviewTemplate) *contentv1.InterviewTemplate {
	if t == nil {
		return nil
	}
	return &contentv1.InterviewTemplate{
		Id:           t.ID,
		CompanyId:    t.CompanyID,
		Slug:         t.Slug,
		Title:        t.Title,
		Description:  t.Description,
		TargetRole:   t.TargetRole,
		TargetLevel:  t.TargetLevel,
		PassingScore: int32(t.PassingScore),
		IsActive:     t.IsActive,
		CreatedAt:    timestamppb.New(t.CreatedAt),
		UpdatedAt:    timestamppb.New(t.UpdatedAt),
	}
}

func toProtoSection(s *catalogmodel.TemplateSection) *contentv1.TemplateSection {
	if s == nil {
		return nil
	}
	return &contentv1.TemplateSection{
		Id:           s.ID,
		TemplateId:   s.TemplateID,
		SectionType:  s.SectionType,
		Title:        s.Title,
		Description:  s.Description,
		Position:     int32(s.Position),
		PassingScore: int32PtrToOptional(s.PassingScore),
		TasksCount:   int32(s.TasksCount),
		TaskIds:      s.TaskIDs,
		CreatedAt:    timestamppb.New(s.CreatedAt),
		UpdatedAt:    timestamppb.New(s.UpdatedAt),
	}
}

func toProtoTask(t *catalogmodel.Task) (*contentv1.Task, error) {
	if t == nil {
		return nil, nil
	}
	metadata, err := metadataToStruct(t.Metadata)
	if err != nil {
		return nil, fmt.Errorf("task %s metadata: %w", t.ID, err)
	}
	return &contentv1.Task{
		Id:               t.ID,
		Slug:             t.Slug,
		Type:             t.Type,
		Title:            t.Title,
		Description:      t.Description,
		Difficulty:       t.Difficulty,
		EstimatedMinutes: int32PtrToOptional(t.EstimatedMinutes),
		Metadata:         metadata,
		Status:           t.Status,
		CreatedAt:        timestamppb.New(t.CreatedAt),
		UpdatedAt:        timestamppb.New(t.UpdatedAt),
	}, nil
}

func toProtoSolution(s *catalogmodel.Solution) *contentv1.TaskSolution {
	if s == nil {
		return nil
	}
	return &contentv1.TaskSolution{
		Id:           s.ID,
		TaskId:       s.TaskID,
		Language:     s.Language,
		SolutionText: s.SolutionText,
		Explanation:  s.Explanation,
		Complexity:   s.Complexity,
		IsPrimary:    s.IsPrimary,
		CreatedAt:    timestamppb.New(s.CreatedAt),
		UpdatedAt:    timestamppb.New(s.UpdatedAt),
	}
}

func toProtoRubric(r *catalogmodel.Rubric, criteria []catalogmodel.RubricCriterion) *contentv1.Rubric {
	if r == nil {
		return nil
	}
	protoCriteria := make([]*contentv1.RubricCriterion, 0, len(criteria))
	for i := range criteria {
		protoCriteria = append(protoCriteria, toProtoCriterion(&criteria[i]))
	}
	return &contentv1.Rubric{
		Id:        r.ID,
		TaskType:  r.TaskType,
		Title:     r.Title,
		Version:   int32(r.Version),
		IsActive:  r.IsActive,
		Criteria:  protoCriteria,
		CreatedAt: timestamppb.New(r.CreatedAt),
		UpdatedAt: timestamppb.New(r.UpdatedAt),
	}
}

func toProtoCriterion(c *catalogmodel.RubricCriterion) *contentv1.RubricCriterion {
	if c == nil {
		return nil
	}
	return &contentv1.RubricCriterion{
		Id:          c.ID,
		RubricId:    c.RubricID,
		Key:         c.Key,
		Title:       c.Title,
		Description: c.Description,
		Weight:      int32(c.Weight),
		MaxScore:    int32(c.MaxScore),
		Position:    int32(c.Position),
		CreatedAt:   timestamppb.New(c.CreatedAt),
		UpdatedAt:   timestamppb.New(c.UpdatedAt),
	}
}

func toProtoTaskBundle(bundle *catalogmodel.TaskBundle) (*contentv1.GetTaskBundleResponse, error) {
	if bundle == nil {
		return nil, status.Error(codes.Internal, "internal error")
	}

	solutions := make([]*contentv1.TaskSolution, 0, len(bundle.Solutions))
	for i := range bundle.Solutions {
		solutions = append(solutions, toProtoSolution(&bundle.Solutions[i]))
	}

	task, err := toProtoTask(bundle.Task)
	if err != nil {
		return nil, err
	}

	return &contentv1.GetTaskBundleResponse{
		Task:      task,
		Solutions: solutions,
		Rubric:    toProtoRubric(bundle.Rubric, bundle.Criteria),
	}, nil
}

func toProtoTemplateDetail(detail *catalogmodel.InterviewTemplateDetail) *contentv1.GetInterviewTemplateDetailResponse {
	if detail == nil {
		return nil
	}
	sections := make([]*contentv1.TemplateSection, 0, len(detail.Sections))
	for i := range detail.Sections {
		sections = append(sections, toProtoSection(&detail.Sections[i]))
	}
	return &contentv1.GetInterviewTemplateDetailResponse{
		Template: toProtoTemplate(detail.Template),
		Sections: sections,
	}
}

func metadataToStruct(raw json.RawMessage) (*structpb.Struct, error) {
	if len(raw) == 0 {
		return structpb.NewStruct(map[string]any{})
	}
	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, fmt.Errorf("unmarshal metadata: %w", err)
	}
	return structpb.NewStruct(data)
}

func int32PtrToOptional(v *int) *int32 {
	if v == nil {
		return nil
	}
	val := int32(*v)
	return &val
}

func toProtoArticleSummary(a *catalogmodel.Article) *contentv1.ArticleSummary {
	if a == nil {
		return nil
	}
	return &contentv1.ArticleSummary{
		Id:             a.ID,
		Slug:           a.Slug,
		Title:          a.Title,
		Summary:        a.Summary,
		Status:         articleStatusToProto(a.Status),
		ReadingMinutes: int32PtrToOptional(a.ReadingMinutes),
		SkillKeys:      a.SkillKeys,
		CreatedAt:      timestamppb.New(a.CreatedAt),
		UpdatedAt:      timestamppb.New(a.UpdatedAt),
	}
}

func toProtoArticle(a *catalogmodel.Article) *contentv1.Article {
	if a == nil {
		return nil
	}
	return &contentv1.Article{
		Id:             a.ID,
		Slug:           a.Slug,
		Title:          a.Title,
		Summary:        a.Summary,
		Body:           a.Body,
		Status:         articleStatusToProto(a.Status),
		ReadingMinutes: int32PtrToOptional(a.ReadingMinutes),
		SkillKeys:      a.SkillKeys,
		Videos:         toProtoArticleVideos(a.Videos),
		LinkedTasks:    toProtoArticleTaskLinks(a.LinkedTasks),
		CreatedAt:      timestamppb.New(a.CreatedAt),
		UpdatedAt:      timestamppb.New(a.UpdatedAt),
	}
}

func toProtoArticleTaskLinks(links []catalogmodel.ArticleTaskLink) []*contentv1.ArticleTaskLink {
	if len(links) == 0 {
		return nil
	}
	out := make([]*contentv1.ArticleTaskLink, 0, len(links))
	for _, link := range links {
		out = append(out, &contentv1.ArticleTaskLink{
			TaskId:     link.TaskID,
			Slug:       link.Slug,
			Title:      link.Title,
			Type:       link.Type,
			Difficulty: link.Difficulty,
			Position:   int32(link.Position),
		})
	}
	return out
}

func mapServiceError(err error) error {
	switch {
	case catalogservice.IsNotFound(err):
		return notFound("not found")
	case catalogservice.IsInvalidArgument(err):
		return invalidArgument(err.Error())
	default:
		return status.Error(codes.Internal, "internal error")
	}
}

func requireIDOrSlug(id, slug string) error {
	if id == "" && slug == "" {
		return invalidArgument("id or slug is required")
	}
	return nil
}

func optionalString(v *string) *string {
	if v == nil || *v == "" {
		return nil
	}
	return v
}
