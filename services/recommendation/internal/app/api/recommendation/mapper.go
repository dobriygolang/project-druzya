package recommendationapi

import (
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoDashboard(d *model.Dashboard) *recommendationv1.GetDashboardResponse {
	if d == nil {
		return &recommendationv1.GetDashboardResponse{}
	}
	return &recommendationv1.GetDashboardResponse{
		ReadinessScore:    int32(d.ReadinessScore),
		ProfileSummary:    optionalString(d.ProfileSummary),
		Strengths:         toProtoInsights(d.Strengths),
		Weaknesses:        toProtoInsights(d.Weaknesses),
		Recommendations:   toProtoRecommendations(d.Recommendations),
		LearningPlan:      toProtoLearningPlan(d.LearningPlan),
		PendingRetryCount: int32(d.PendingRetryCount),
	}
}

func toProtoInsights(items []model.SkillInsight) []*recommendationv1.SkillInsight {
	out := make([]*recommendationv1.SkillInsight, 0, len(items))
	for _, item := range items {
		out = append(out, &recommendationv1.SkillInsight{
			SkillKey:   item.SkillKey,
			Score:      int32(item.Score),
			Confidence: int32(item.Confidence),
		})
	}
	return out
}

func toProtoRecommendations(items []model.Recommendation) []*recommendationv1.Recommendation {
	out := make([]*recommendationv1.Recommendation, 0, len(items))
	for _, item := range items {
		rec := &recommendationv1.Recommendation{
			Id:          item.ID,
			Type:        item.Type,
			Priority:    item.Priority,
			Title:       item.Title,
			Description: item.Description,
			Status:      item.Status,
			CreatedAt:   timestamppb.New(item.CreatedAt),
		}
		if item.SkillKey != nil {
			rec.SkillKey = item.SkillKey
		}
		out = append(out, rec)
	}
	return out
}

func toProtoLearningPlan(items []model.LearningPlanItem) []*recommendationv1.LearningPlanItem {
	out := make([]*recommendationv1.LearningPlanItem, 0, len(items))
	for _, item := range items {
		plan := &recommendationv1.LearningPlanItem{
			Id:        item.ID,
			Type:      item.Type,
			Title:     item.Title,
			Status:    item.Status,
			Position:  int32(item.Position),
			CreatedAt: timestamppb.New(item.CreatedAt),
		}
		if item.TaskID != nil {
			plan.TaskId = item.TaskID
		}
		if item.SkillKey != nil {
			plan.SkillKey = item.SkillKey
		}
		if item.Description != nil {
			plan.Description = item.Description
		}
		out = append(out, plan)
	}
	return out
}

func optionalString(v *string) *string {
	if v == nil || *v == "" {
		return nil
	}
	return v
}
