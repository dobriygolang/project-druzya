package identity

import (
	"context"
)

// User is a minimal identity user projection.
type User struct {
	ID       string
	Timezone string
}

// Client resolves users from identity-service.
type Client interface {
	GetUser(ctx context.Context, userID string) (*User, error)
}
