// Package grant_subscription is the CQRS command that grants an internal
// subscription: it cancels any previous active subscription and creates the new
// one atomically. Reference command shape for the billing service.
package grant_subscription

import (
	"fmt"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Command grants a plan to a user until an optional period end.
type Command struct {
	UserID    string
	PlanSlug  string
	PeriodEnd *time.Time
}

// Validate checks required fields.
func (c Command) Validate() error {
	if c.UserID == "" || c.PlanSlug == "" {
		return fmt.Errorf("user_id and plan_slug required: %w", model.ErrInvalidInput)
	}
	return nil
}
