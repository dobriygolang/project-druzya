package service

import (
	"context"
	"strings"

	identityadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/identity"
	recommendationadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/recommendation"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

func (s *trackerService) GetToday(ctx context.Context, userID string, localDate, timezone *string) (*model.TodayView, error) {
	tz := resolveTimezone(ctx, s.identity, userID, timezone)
	date := ""
	if localDate != nil {
		date = *localDate
	}
	if s.recommendation != nil {
		_ = s.recommendation.ReconcileUserPlan(ctx, userID, date, tz)
	}
	board, err := s.ensureDefaultBoard(ctx, userID)
	if err != nil {
		return nil, err
	}
	open := filterOpenTasks(board.Tasks)
	epicNames := epicNameMap(board.Epics)
	deferred := []string{}
	if settings, err := s.repo.GetUserSettings(ctx, userID); err == nil && settings != nil {
		deferred = settings.DeferredSprintEpicNames
	}
	open = filterTasksForSprintFocus(open, epicNames, deferred)
	if board.ActiveSprint == nil {
		return &model.TodayView{
			BudgetCapacity: 1.5,
			LocalDate:      date,
			ActiveSprint:   board.ActiveSprint,
			Epics:          board.Epics,
		}, nil
	}
	if s.recommendation == nil {
		view := fallbackTodayView(open, board)
		view.LocalDate = date
		return view, nil
	}
	inputs := make([]recommendationadapter.PlanTaskInput, 0, len(open))
	for _, t := range open {
		epicID := ""
		if t.EpicID != nil {
			epicID = *t.EpicID
		}
		inputs = append(inputs, recommendationadapter.PlanTaskInput{
			ID: t.ID, Title: t.Title, EstimateDays: t.EstimateDays, Position: t.Position,
			Source: string(t.Source), Metadata: t.Metadata, CreatedAt: t.CreatedAt, EpicID: epicID,
		})
	}
	plan, err := s.recommendation.PlanToday(ctx, userID, date, tz, inputs)
	if err != nil {
		view := fallbackTodayView(open, board)
		view.LocalDate = date
		return view, nil
	}
	taskByID := map[string]model.Task{}
	for _, t := range open {
		taskByID[t.ID] = t
	}
	view := &model.TodayView{
		BudgetUsed:     plan.BudgetUsed,
		BudgetCapacity: plan.BudgetCapacity,
		LocalDate:      plan.LocalDate,
		ActiveSprint:   board.ActiveSprint,
		Epics:          board.Epics,
	}
	view.TodayTasks = buildTodayEntries(plan.TodayTaskIDs, taskByID, epicNames, plan.TaskMeta)
	view.LaterTasks = buildTodayEntries(plan.LaterTaskIDs, taskByID, epicNames, plan.TaskMeta)
	return view, nil
}

func resolveTimezone(ctx context.Context, identity identityadapter.Client, userID string, clientTZ *string) string {
	if clientTZ != nil {
		if tz := strings.TrimSpace(*clientTZ); tz != "" {
			return tz
		}
	}
	if identity == nil || userID == "" {
		return ""
	}
	user, err := identity.GetUser(ctx, userID)
	if err != nil || user == nil {
		return ""
	}
	return strings.TrimSpace(user.Timezone)
}

func filterTasksForSprintFocus(tasks []model.Task, epicNames map[string]string, deferred []string) []model.Task {
	if len(deferred) == 0 {
		return tasks
	}
	out := make([]model.Task, 0, len(tasks))
	for _, t := range tasks {
		name := ""
		if t.EpicID != nil {
			name = epicNames[*t.EpicID]
		}
		if model.IsEpicDeferredForSprint(name, deferred) {
			continue
		}
		out = append(out, t)
	}
	return out
}

func filterOpenTasks(tasks []model.Task) []model.Task {
	out := make([]model.Task, 0, len(tasks))
	for _, t := range tasks {
		if t.Done || model.IsTaskArchived(t.Metadata) {
			continue
		}
		out = append(out, t)
	}
	return out
}

func epicNameMap(epics []model.Epic) map[string]string {
	out := map[string]string{}
	for _, e := range epics {
		out[e.ID] = e.Name
	}
	return out
}

func buildTodayEntries(ids []string, tasks map[string]model.Task, epicNames map[string]string, meta map[string]recommendationadapter.PlanTaskMeta) []model.TodayTaskEntry {
	out := make([]model.TodayTaskEntry, 0, len(ids))
	for _, id := range ids {
		t, ok := tasks[id]
		if !ok {
			continue
		}
		reason := model.TodayReasonUser
		if m, ok := meta[id]; ok {
			reason = recommendationadapter.ReasonFromString(m.ReasonCode)
		}
		epicName := ""
		if t.EpicID != nil {
			epicName = epicNames[*t.EpicID]
		}
		actionPath := actionPathFromMeta(t.Metadata)
		out = append(out, model.TodayTaskEntry{
			Task: t, ReasonCode: reason, EpicName: epicName, ActionPath: actionPath,
		})
	}
	return out
}

func actionPathFromMeta(meta map[string]any) string {
	if meta == nil {
		return ""
	}
	if v, ok := meta["action_path"].(string); ok {
		return v
	}
	return ""
}

func fallbackTodayView(open []model.Task, board *model.Board) *model.TodayView {
	epicNames := epicNameMap(board.Epics)
	limit := 3
	if len(open) < limit {
		limit = len(open)
	}
	today := make([]model.TodayTaskEntry, 0, limit)
	for i := 0; i < limit; i++ {
		t := open[i]
		epicName := ""
		if t.EpicID != nil {
			epicName = epicNames[*t.EpicID]
		}
		today = append(today, model.TodayTaskEntry{
			Task: t, ReasonCode: model.TodayReasonUser, EpicName: epicName,
			ActionPath: actionPathFromMeta(t.Metadata),
		})
	}
	later := make([]model.TodayTaskEntry, 0)
	for i := limit; i < len(open); i++ {
		t := open[i]
		epicName := ""
		if t.EpicID != nil {
			epicName = epicNames[*t.EpicID]
		}
		later = append(later, model.TodayTaskEntry{
			Task: t, ReasonCode: model.TodayReasonUser, EpicName: epicName,
			ActionPath: actionPathFromMeta(t.Metadata),
		})
	}
	return &model.TodayView{
		TodayTasks: today, LaterTasks: later, BudgetCapacity: 1.5,
		ActiveSprint: board.ActiveSprint, Epics: board.Epics,
	}
}
