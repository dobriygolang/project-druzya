package model

import "time"

// Item is a sample catalog entity — replace with your domain model.
type Item struct {
	ID        string
	Slug      string
	Title     string
	CreatedAt time.Time
	UpdatedAt time.Time
}
