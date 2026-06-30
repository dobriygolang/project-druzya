package model

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// PublishedBoard is a public read-only Excalidraw snapshot.
type PublishedBoard struct {
	ID          uuid.UUID
	UserID      uuid.UUID
	Slug        string
	Title       string
	SceneJSON   string
	PublishedAt time.Time
}

func BoardPublishURL(baseURL, slug string) string {
	baseURL = strings.TrimRight(baseURL, "/")
	return baseURL + "/board/" + slug
}
