package start_pro_trial

import (
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Command starts a one-time internal Pro trial for a user.
type Command struct {
	UserID string
}

// Validate checks required fields.
func (c Command) Validate() error {
	if c.UserID == "" {
		return fmt.Errorf("user_id required: %w", model.ErrInvalidInput)
	}
	return nil
}
