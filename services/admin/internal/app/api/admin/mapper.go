package adminapi

import (
	"encoding/json"

	billingadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing"
	aiadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/ai"
	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoCompany(c contentadapter.Company) *adminv1.Company {
	return &adminv1.Company{
		Id:          c.ID,
		Slug:        c.Slug,
		Name:        c.Name,
		Description: c.Description,
		IsActive:    c.IsActive,
		CreatedAt:   timestamppb.New(c.CreatedAt),
		UpdatedAt:   timestamppb.New(c.UpdatedAt),
	}
}

func toProtoTask(t contentadapter.Task) (*adminv1.Task, error) {
	meta, err := rawJSONToStruct(t.Metadata)
	if err != nil {
		return nil, err
	}
	out := &adminv1.Task{
		Id:          t.ID,
		Slug:        t.Slug,
		Type:        t.Type,
		Title:       t.Title,
		Description: t.Description,
		Difficulty:  t.Difficulty,
		Metadata:    meta,
		Status:      t.Status,
		CreatedAt:   timestamppb.New(t.CreatedAt),
		UpdatedAt:   timestamppb.New(t.UpdatedAt),
	}
	if t.EstimatedMinutes != nil {
		v := int32(*t.EstimatedMinutes)
		out.EstimatedMinutes = &v
	}
	return out, nil
}

func toProtoSolution(s contentadapter.Solution) *adminv1.TaskSolution {
	return &adminv1.TaskSolution{
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

func rawJSONToStruct(raw []byte) (*structpb.Struct, error) {
	if len(raw) == 0 {
		return &structpb.Struct{}, nil
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return structpb.NewStruct(m)
}

func optionalString(v *string) *string {
	if v == nil || *v == "" {
		return nil
	}
	return v
}

func toProtoTemplate(t contentadapter.InterviewTemplate) *adminv1.InterviewTemplate {
	return &adminv1.InterviewTemplate{
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

func toProtoSection(s contentadapter.TemplateSection) *adminv1.TemplateSection {
	out := &adminv1.TemplateSection{
		Id:          s.ID,
		TemplateId:  s.TemplateID,
		SectionType: s.SectionType,
		Title:       s.Title,
		Description: s.Description,
		Position:    int32(s.Position),
		TasksCount:  int32(s.TasksCount),
		TaskIds:     s.TaskIDs,
		CreatedAt:   timestamppb.New(s.CreatedAt),
		UpdatedAt:   timestamppb.New(s.UpdatedAt),
	}
	if s.PassingScore != nil {
		v := int32(*s.PassingScore)
		out.PassingScore = &v
	}
	return out
}

func toProtoTemplateDetail(d *contentadapter.InterviewTemplateDetail) *adminv1.GetInterviewTemplateDetailResponse {
	if d == nil {
		return nil
	}
	sections := make([]*adminv1.TemplateSection, 0, len(d.Sections))
	for _, item := range d.Sections {
		sections = append(sections, toProtoSection(item))
	}
	return &adminv1.GetInterviewTemplateDetailResponse{
		Template: toProtoTemplate(d.Template),
		Sections: sections,
	}
}

func toProtoPlan(p billingadapter.PlanCatalog) *adminv1.PlanCatalog {
	out := &adminv1.PlanCatalog{
		Slug:       p.Slug,
		Name:       p.Name,
		Tagline:    p.Tagline,
		Highlight:  p.Highlight,
		Highlights: append([]string(nil), p.Highlights...),
		Features:   map[string]bool{},
		Limits:     map[string]*adminv1.PlanEntitlementSpec{},
	}
	for k, v := range p.Features {
		out.Features[k] = v
	}
	for k, lim := range p.Limits {
		spec := &adminv1.PlanEntitlementSpec{
			Type:      lim.Type,
			Unlimited: lim.Unlimited,
			Period:    lim.Period,
			Value:     lim.Value,
		}
		if lim.Limit != nil {
			v := int32(*lim.Limit)
			spec.Limit = &v
		}
		out.Limits[k] = spec
	}
	return out
}

func toProtoUserEntitlements(v *billingadapter.UserEntitlements) *adminv1.UserEntitlements {
	if v == nil {
		return &adminv1.UserEntitlements{}
	}
	out := &adminv1.UserEntitlements{
		UserId:   v.UserID,
		PlanSlug: v.PlanSlug,
		PlanName: v.PlanName,
		Features: map[string]bool{},
		Limits:   map[string]*adminv1.UsageLimit{},
	}
	for k, val := range v.Features {
		out.Features[k] = val
	}
	for k, lim := range v.Limits {
		item := &adminv1.UsageLimit{
			Used:        int32(lim.Used),
			Unlimited:   lim.Unlimited,
			PeriodStart: timestamppb.New(lim.PeriodStart),
			PeriodEnd:   timestamppb.New(lim.PeriodEnd),
		}
		if lim.Limit != nil {
			v := int32(*lim.Limit)
			item.Limit = &v
		}
		if lim.Remaining != nil {
			v := int32(*lim.Remaining)
			item.Remaining = &v
		}
		out.Limits[k] = item
	}
	return out
}

func toProtoEvaluationJob(j aiadapter.EvaluationJob) *adminv1.EvaluationJob {
	out := &adminv1.EvaluationJob{
		Id:         j.ID,
		AttemptId:  j.AttemptID,
		UserId:     j.UserID,
		TaskId:     j.TaskID,
		Status:     evaluationStatusToProto(j.Status),
		RetryCount: int32(j.RetryCount),
		Retryable:  j.Retryable,
		Error:      j.Error,
		CreatedAt:  timestamppb.New(j.CreatedAt),
		UpdatedAt:  timestamppb.New(j.UpdatedAt),
	}
	if j.NextRetryAt != nil {
		out.NextRetryAt = timestamppb.New(*j.NextRetryAt)
	}
	if j.StartedAt != nil {
		out.StartedAt = timestamppb.New(*j.StartedAt)
	}
	if j.CompletedAt != nil {
		out.CompletedAt = timestamppb.New(*j.CompletedAt)
	}
	return out
}

func evaluationStatusToProto(s aiadapter.EvaluationJobStatus) adminv1.EvaluationJobStatus {
	switch s {
	case aiadapter.JobStatusPending:
		return adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_PENDING
	case aiadapter.JobStatusRunning:
		return adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_RUNNING
	case aiadapter.JobStatusCompleted:
		return adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_COMPLETED
	case aiadapter.JobStatusFailed:
		return adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_FAILED
	default:
		return adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_UNSPECIFIED
	}
}

func evaluationStatusFromProto(s adminv1.EvaluationJobStatus) *aiadapter.EvaluationJobStatus {
	var out aiadapter.EvaluationJobStatus
	switch s {
	case adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_PENDING:
		out = aiadapter.JobStatusPending
	case adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_RUNNING:
		out = aiadapter.JobStatusRunning
	case adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_COMPLETED:
		out = aiadapter.JobStatusCompleted
	case adminv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_FAILED:
		out = aiadapter.JobStatusFailed
	default:
		return nil
	}
	return &out
}

func toProtoLLMConfig(c *aiadapter.LLMRuntimeConfig) *adminv1.LLMRuntimeConfig {
	if c == nil {
		return &adminv1.LLMRuntimeConfig{}
	}
	return &adminv1.LLMRuntimeConfig{
		Version:           c.Version,
		ChainOrder:        append([]string(nil), c.ChainOrder...),
		TaskMapJson:       c.TaskMapJSON,
		VirtualChainsJson: c.VirtualChainsJSON,
	}
}

func structToRawJSON(s *structpb.Struct) ([]byte, error) {
	if s == nil {
		return []byte("{}"), nil
	}
	return json.Marshal(s.AsMap())
}
