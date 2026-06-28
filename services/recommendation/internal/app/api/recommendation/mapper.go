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
		DailyBrief:        toProtoDailyBrief(d.DailyBrief),
		Strengths:         toProtoInsights(d.Strengths),
		Weaknesses:        toProtoInsights(d.Weaknesses),
		Recommendations:   toProtoRecommendations(d.Recommendations),
		LearningPlan:      toProtoLearningPlan(d.LearningPlan),
		PendingRetryCount: int32(d.PendingRetryCount),
		ReadArticleSlugs:  append([]string(nil), d.ReadArticleSlugs...),
	}
}

func toProtoDailyBrief(b model.DailyBrief) *recommendationv1.DailyBrief {
	items := make([]*recommendationv1.DailyBriefItem, 0, len(b.Items))
	for _, item := range b.Items {
		protoItem := &recommendationv1.DailyBriefItem{
			Type:  dailyBriefItemTypeToProto(item.Type),
			Title: item.Title,
		}
		if item.Description != nil {
			protoItem.Description = item.Description
		}
		if item.ActionLabel != nil {
			protoItem.ActionLabel = item.ActionLabel
		}
		if item.ActionPath != nil {
			protoItem.ActionPath = item.ActionPath
		}
		if item.RetryItemID != nil {
			protoItem.RetryItemId = item.RetryItemID
		}
		if item.SkillKey != nil {
			protoItem.SkillKey = item.SkillKey
		}
		if item.SecondaryActionLabel != nil {
			protoItem.SecondaryActionLabel = item.SecondaryActionLabel
		}
		if item.SecondaryActionPath != nil {
			protoItem.SecondaryActionPath = item.SecondaryActionPath
		}
		items = append(items, protoItem)
	}
	return &recommendationv1.DailyBrief{
		ReadinessScore: int32(b.ReadinessScore),
		Items:          items,
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
			Type:        recommendationTypeToProto(item.Type),
			Priority:    recommendationPriorityToProto(item.Priority),
			Title:       item.Title,
			Description: item.Description,
			Status:      recommendationStatusToProto(item.Status),
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
			Type:      learningPlanItemTypeToProto(item.Type),
			Title:     item.Title,
			Status:    learningPlanItemStatusToProto(item.Status),
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

func toProtoMockHubContext(h *model.MockHubContext) *recommendationv1.GetMockHubContextResponse {
	if h == nil {
		return &recommendationv1.GetMockHubContextResponse{}
	}
	staleModes := make([]*recommendationv1.StalePracticeMode, 0, len(h.StaleModes))
	for _, m := range h.StaleModes {
		item := &recommendationv1.StalePracticeMode{
			SessionMode: m.SessionMode,
			TaskType:    m.TaskType,
			DaysSince:   int32(m.DaysSince),
		}
		if m.LastPracticedAt != nil {
			item.LastPracticedAt = timestamppb.New(*m.LastPracticedAt)
		}
		staleModes = append(staleModes, item)
	}

	templateProgress := make([]*recommendationv1.TemplateProgress, 0, len(h.TemplateProgress))
	for _, p := range h.TemplateProgress {
		item := &recommendationv1.TemplateProgress{
			TemplateId:     p.TemplateID,
			BestTotalScore: int32(p.BestTotalScore),
			Passed:         p.Passed,
			AttemptsCount:  int32(p.AttemptsCount),
			LastAttemptAt:  timestamppb.New(p.LastAttemptAt),
		}
		if p.LastPassedAt != nil {
			item.LastPassedAt = timestamppb.New(*p.LastPassedAt)
		}
		if p.LastSessionID != nil {
			item.LastSessionId = p.LastSessionID
		}
		templateProgress = append(templateProgress, item)
	}

	coverage := make([]*recommendationv1.TaskTypeCoverage, 0, len(h.TaskTypeCoverage))
	for _, c := range h.TaskTypeCoverage {
		coverage = append(coverage, &recommendationv1.TaskTypeCoverage{
			TaskType:      c.TaskType,
			PassedCount:   int32(c.PassedCount),
			AttemptsCount: int32(c.AttemptsCount),
		})
	}

	return &recommendationv1.GetMockHubContextResponse{
		StaleModes:       staleModes,
		TemplateProgress: templateProgress,
		TaskTypeCoverage: coverage,
	}
}

func toProtoTaskPickerHints(h *model.TaskPickerHints) *recommendationv1.GetTaskPickerHintsResponse {
	if h == nil {
		return &recommendationv1.GetTaskPickerHintsResponse{}
	}
	review := make([]*recommendationv1.ReviewTaskCandidate, 0, len(h.ReviewCandidates))
	for _, c := range h.ReviewCandidates {
		review = append(review, &recommendationv1.ReviewTaskCandidate{
			TaskId:       c.TaskID,
			TaskType:     c.TaskType,
			BestScore:    int32(c.BestScore),
			LastPassedAt: timestamppb.New(c.LastPassedAt),
		})
	}
	return &recommendationv1.GetTaskPickerHintsResponse{
		PassedTaskIds:    append([]string(nil), h.PassedTaskIDs...),
		ReviewCandidates: review,
	}
}
