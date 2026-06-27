package content

import (
	"context"
	"encoding/json"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

// Client reads catalog data from content-service.
type Client interface {
	GetTask(ctx context.Context, taskID string) (*model.TaskSummary, error)
	Ping(ctx context.Context) error
}

// ParseTaskMetadata unmarshals task metadata JSON tolerantly.
func ParseTaskMetadata(raw json.RawMessage) (*model.TaskMetadata, error) {
	if len(raw) == 0 {
		return &model.TaskMetadata{}, nil
	}
	var meta model.TaskMetadata
	if err := json.Unmarshal(raw, &meta); err != nil {
		return &model.TaskMetadata{}, nil
	}
	return &meta, nil
}
