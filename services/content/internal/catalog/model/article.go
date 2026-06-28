package model

import "time"

// Article is a knowledge-base entry linked to skill keys.
type Article struct {
	ID              string
	Slug            string
	Title           string
	Summary         string
	Body            string
	Status          ArticleStatus
	ReadingMinutes  *int
	SkillKeys       []string
	Videos          []ArticleVideo
	LinkedTasks     []ArticleTaskLink
	TaskIDs         []string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
