package identity

import (
	"context"
)

// User is a minimal identity user projection.
type User struct {
	ID         string
	Username   string
	TelegramID *int64
}

// Client resolves users from identity-service.
type Client interface {
	GetUser(ctx context.Context, userID string) (*User, error)
	GetUserByTelegramID(ctx context.Context, telegramID int64) (*User, error)
}
