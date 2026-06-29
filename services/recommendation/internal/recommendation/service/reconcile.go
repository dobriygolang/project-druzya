package service

import (
	"context"
	"strings"
	"sync"
	"time"

	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/plan"
)

const reconcileDebounce = 30 * time.Second

var reconcileLast sync.Map // userID -> time.Time

func (s *recommendationService) shouldReconcile(key string) bool {
	now := time.Now()
	if v, ok := reconcileLast.Load(key); ok {
		if now.Sub(v.(time.Time)) < reconcileDebounce {
			return false
		}
	}
	reconcileLast.Store(key, now)
	return true
}

func (s *recommendationService) ReconcileUserPlan(ctx context.Context, userID, localDate, timezone string) error {
	if s.tracker == nil || userID == "" {
		return nil
	}
	clock := plan.ResolvePlanClock(localDate, timezone)
	if !s.shouldReconcile(plan.ReconcileDebounceKey(userID, clock.LocalDate)) {
		return nil
	}
	input, err := s.loadPlanInput(ctx, userID)
	if err != nil {
		return err
	}
	desired := plan.BuildDesiredTasks(input)
	for _, d := range desired {
		if strings.TrimSpace(d.DedupKey) == "" {
			continue
		}
		dedup := d.DedupKey
		epic := d.EpicName
		est := d.EstimateDays
		meta := d.Metadata
		if meta == nil {
			meta = map[string]any{}
		}
		meta["system_managed"] = true
		s.pushTrackerTask(ctx, trackeradapter.CreateTaskParams{
			UserID:       userID,
			Title:        d.Title,
			Source:       d.Source,
			Metadata:     meta,
			DedupKey:     &dedup,
			EpicName:     &epic,
			EstimateDays: &est,
		})
	}
	return nil
}

func (s *recommendationService) PlanToday(ctx context.Context, userID, localDate, timezone string, tasks []plan.TaskInput) (*plan.TodayPartition, map[string]plan.ScoredTask, error) {
	scores, err := s.repo.ListSkillScoresByUser(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	skillMap := map[string]int{}
	for _, sc := range scores {
		skillMap[sc.SkillKey] = sc.Score
	}
	clock := plan.ResolvePlanClock(localDate, timezone)
	scored := make([]plan.ScoredTask, 0, len(tasks))
	for _, t := range tasks {
		scored = append(scored, plan.ScoreTask(t, skillMap, clock.Now))
	}
	part := plan.PartitionToday(scored)
	meta := map[string]plan.ScoredTask{}
	for _, t := range scored {
		meta[t.ID] = t
	}
	return &part, meta, nil
}
