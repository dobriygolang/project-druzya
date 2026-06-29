package service

import (
	"context"
	"strings"

	identityadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/identity"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

func (s *trackerService) GetToday(ctx context.Context, userID string, localDate, timezone *string) (*model.TodayView, error) {
	tz := resolveTimezone(ctx, s.identity, userID, timezone)
	date := ""
	if localDate != nil {
		date = *localDate
	}
	_ = tz

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

	view := fallbackTodayView(open, board)
	view.LocalDate = date
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
