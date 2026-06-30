package model

import (
	"errors"
	"time"
)

var (
	ErrInvalidArgument = errors.New("invalid argument")
	ErrNotFound        = errors.New("not found")
	ErrForbidden       = errors.New("forbidden")
)

type WorkTask struct {
	ID                   string
	UserID               string
	Status               string
	Kind                 string
	Title                string
	CreatedAt            time.Time
	UpdatedAt            time.Time
	CompletedAt          *time.Time
	ScheduledStart       *time.Time
	ScheduledDurationMin *int
	GoogleEventID        *string
	ArchivedAt           *time.Time
}
