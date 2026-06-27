package model

import "time"

// Company is a preparation profile or employer track.
type Company struct {
	ID          string
	Slug        string
	Name        string
	Description *string
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
