package model

import (
	"encoding/json"
	"time"
)

// Task is a catalog interview task definition.
type Task struct {
	ID               string
	Slug             string
	Type             string
	Title            string
	Description      string
	Difficulty       string
	EstimatedMinutes *int
	Metadata         json.RawMessage
	Status           string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Solution is a reference solution for a task.
type Solution struct {
	ID           string
	TaskID       string
	Language     *string
	SolutionText string
	Explanation  *string
	Complexity   *string
	IsPrimary    bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// TaskBundle aggregates task data for ai-service evaluation.
type TaskBundle struct {
	Task      *Task
	Solutions []Solution
	Rubric    *Rubric
	Criteria  []RubricCriterion
}
