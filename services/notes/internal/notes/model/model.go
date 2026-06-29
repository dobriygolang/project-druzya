package model

import "time"

type Note struct {
	ID        string
	UserID    string
	FolderID  *string
	Title     string
	BodyMD    string
	Encrypted bool
	Published bool
	PublishSlug *string
	PublishedAt *time.Time
	SizeBytes int
	CreatedAt time.Time
	UpdatedAt time.Time
}

type NoteSummary struct {
	ID        string
	Title     string
	UpdatedAt time.Time
	SizeBytes int
	FolderID  *string
}

type NoteMeta struct {
	ID        string
	Encrypted bool
	Published bool
}

type Folder struct {
	ID        string
	UserID    string
	Name      string
	ParentID  *string
	CreatedAt time.Time
	UpdatedAt time.Time
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
