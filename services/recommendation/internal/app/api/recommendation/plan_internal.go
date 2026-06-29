package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/plan"
)

func (i *Implementation) ReconcileUserPlan(ctx context.Context, req *recommendationv1.ReconcileUserPlanRequest) (*recommendationv1.ReconcileUserPlanResponse, error) {
	if req.GetUserId() == "" {
		return nil, invalidArgument("user_id is required")
	}
	localDate := ""
	if req.LocalDate != nil {
		localDate = *req.LocalDate
	}
	timezone := ""
	if req.Timezone != nil {
		timezone = *req.Timezone
	}
	if err := i.service.ReconcileUserPlan(ctx, req.GetUserId(), localDate, timezone); err != nil {
		return nil, mapServiceError(err)
	}
	return &recommendationv1.ReconcileUserPlanResponse{}, nil
}

func (i *Implementation) PlanToday(ctx context.Context, req *recommendationv1.PlanTodayRequest) (*recommendationv1.PlanTodayResponse, error) {
	if req.GetUserId() == "" {
		return nil, invalidArgument("user_id is required")
	}
	inputs := make([]plan.TaskInput, 0, len(req.GetTasks()))
	for _, t := range req.GetTasks() {
		createdAt := t.GetCreatedAt().AsTime()
		epicID := ""
		if t.EpicId != nil {
			epicID = *t.EpicId
		}
		inputs = append(inputs, plan.TaskInput{
			ID: t.GetId(), Title: t.GetTitle(), EstimateDays: float64(t.GetEstimateDays()),
			Position: int(t.GetPosition()), Source: t.GetSource(),
			Metadata: t.GetMetadata().AsMap(), CreatedAt: createdAt, EpicID: epicID,
		})
	}
	localDate := ""
	if req.LocalDate != nil {
		localDate = *req.LocalDate
	}
	timezone := ""
	if req.Timezone != nil {
		timezone = *req.Timezone
	}
	part, meta, err := i.service.PlanToday(ctx, req.GetUserId(), localDate, timezone, inputs)
	if err != nil {
		return nil, mapServiceError(err)
	}
	clock := plan.ResolvePlanClock(localDate, timezone)
	resp := &recommendationv1.PlanTodayResponse{
		BudgetUsed: float32(part.BudgetUsed), BudgetCapacity: float32(part.BudgetCap),
		LocalDate: clock.LocalDate,
	}
	for _, t := range part.Today {
		resp.TodayTaskIds = append(resp.TodayTaskIds, t.ID)
	}
	for _, t := range part.Later {
		resp.LaterTaskIds = append(resp.LaterTaskIds, t.ID)
	}
	for id, m := range meta {
		resp.TaskMeta = append(resp.TaskMeta, &recommendationv1.PlanTodayTaskMeta{
			TaskId: id, ReasonCode: m.ReasonCode, Score: m.Score,
		})
	}
		return resp, nil
}
