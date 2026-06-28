package content

import "context"

// Task is minimal task metadata from content-service.
type Task struct {
	ID     string
	Slug   string
	Type   string
	Title  string
	Status string
}

// Article is a published knowledge-base article linked to skill keys.
type Article struct {
	ID       string
	Slug     string
	Title    string
	Summary  string
	SkillKeys []string
}

// Client reads catalog data from content-service.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	GetTask(ctx context.Context, taskID string) (*Task, error)
	ListArticlesBySkillKeys(ctx context.Context, skillKeys []string) ([]Article, error)
}
