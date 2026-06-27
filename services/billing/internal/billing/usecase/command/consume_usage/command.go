// Package consume_usage is the CQRS command that atomically checks and consumes
// a usage quota for a user. Reference command shape for the billing service.
package consume_usage

import (
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Command consumes `Amount` of the given entitlement key for a user.
type Command struct {
	UserID string
	Key    string
	Amount int
}

// Validate checks required fields and defaults the amount.
func (c *Command) Validate() error {
	if c.UserID == "" || c.Key == "" {
		return fmt.Errorf("user_id and key required: %w", model.ErrInvalidInput)
	}
	if c.Amount <= 0 {
		c.Amount = 1
	}
	return nil
}
