package update_plan_entitlement

import (
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

// Command updates one plan entitlement row.
type Command struct {
	PlanSlug string
	Key      string
	Spec     entitlement.Value
}

// Validate checks required fields.
func (c Command) Validate() error {
	if c.PlanSlug == "" || c.Key == "" {
		return fmt.Errorf("plan_slug and key required: %w", model.ErrInvalidInput)
	}
	if c.Spec.Type == "" {
		return fmt.Errorf("spec.type required: %w", model.ErrInvalidInput)
	}
	return nil
}
