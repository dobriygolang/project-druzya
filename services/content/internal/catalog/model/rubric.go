package model

import "time"

// Rubric is a scoring rubric for a task type.
type Rubric struct {
	ID        string
	TaskType  string
	Title     string
	Version   int
	IsActive  bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

// RubricCriterion is a weighted criterion inside a rubric.
type RubricCriterion struct {
	ID          string
	RubricID    string
	Key         string
	Title       string
	Description *string
	Weight      int
	MaxScore    int
	Position    int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
