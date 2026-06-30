package model

import "time"

type Note struct {
	ID          string
	UserID      string
	Title       string
	BodyMD      string
	Encrypted   bool
	Published   bool
	PublishSlug *string
	PublishedAt *time.Time
	SizeBytes   int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type NoteSummary struct {
	ID        string
	Title     string
	UpdatedAt time.Time
	SizeBytes int
}

type PublishStatus struct {
	Published   bool
	Slug        string
	URL         string
	PublishedAt *time.Time
}

type ShareToWebResult struct {
	Slug             string
	URL              string
	PublishedAt      time.Time
	AlreadyPublished bool
}

// PublishedNote is a public read-only view (no auth).
type PublishedNote struct {
	Title       string
	BodyMD      string
	PublishedAt time.Time
}
