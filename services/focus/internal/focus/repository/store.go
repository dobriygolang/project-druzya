package repository

import (
	"context"
	"time"

	focusmodel "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/model"
)

// Store is the persistence port consumed by the domain layer.
type Store interface {
	CreateSession(ctx context.Context, userID, mode, pinnedTitle string, taskID *string) (*focusmodel.Session, error)
	EndSession(ctx context.Context, userID, sessionID string, secondsFocused, pomodorosCompleted int) (*focusmodel.Session, error)
	GetStats(ctx context.Context, userID string, upTo time.Time) (*focusmodel.Stats, error)
}

var _ Store = (*Repository)(nil)
