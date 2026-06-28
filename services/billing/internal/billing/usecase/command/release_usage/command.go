package release_usage

import (
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Command releases previously consumed usage quota for a user.
type Command struct {
	UserID         string
	Key            string
	Amount         int
	IdempotencyKey string
}

// Validate checks required fields and defaults the amount.
func (c *Command) Validate() error {
	if c.UserID == "" || c.Key == "" || c.IdempotencyKey == "" {
		return fmt.Errorf("user_id, key and idempotency_key required: %w", model.ErrInvalidInput)
	}
	if c.Amount <= 0 {
		c.Amount = 1
	}
	return nil
}
