package plan

import "time"

type DesiredTask struct {
	DedupKey     string
	Title        string
	EpicName     string
	EstimateDays float64
	Source       string
	Metadata     map[string]any
	BriefType    string
}

type TaskInput struct {
	ID           string
	Title        string
	EstimateDays float64
	Position     int
	Source       string
	Metadata     map[string]any
	CreatedAt    time.Time
	EpicID       string
}

type ScoredTask struct {
	TaskInput
	Score      float64
	ReasonCode string
}

type TodayPartition struct {
	Today       []ScoredTask
	Later       []ScoredTask
	BudgetUsed  float64
	BudgetCap   float64
}
