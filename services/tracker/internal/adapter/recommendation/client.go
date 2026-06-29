package recommendation

import (
	"context"
	"time"

	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

type PlanTaskInput struct {
	ID           string
	Title        string
	EstimateDays float64
	Position     int
	Source       string
	Metadata     map[string]any
	CreatedAt    time.Time
	EpicID       string
}

type PlanTaskMeta struct {
	TaskID     string
	ReasonCode string
	Score      float64
}

type TodayPlan struct {
	TodayTaskIDs   []string
	LaterTaskIDs   []string
	BudgetUsed     float64
	BudgetCapacity float64
	LocalDate      string
	TaskMeta       map[string]PlanTaskMeta
}

type Client interface {
	ReconcileUserPlan(ctx context.Context, userID, localDate, timezone string) error
	PlanToday(ctx context.Context, userID, localDate, timezone string, tasks []PlanTaskInput) (*TodayPlan, error)
	Ping(ctx context.Context) error
}

func ReasonFromString(code string) model.TodayReasonCode {
	switch code {
	case "retry":
		return model.TodayReasonRetry
	case "review":
		return model.TodayReasonReview
	case "skill":
		return model.TodayReasonSkill
	case "mock":
		return model.TodayReasonMock
	case "learning":
		return model.TodayReasonLearning
	default:
		return model.TodayReasonUser
	}
}
