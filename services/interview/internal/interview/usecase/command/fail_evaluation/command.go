package fail_evaluation

import (
	"fmt"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// Command marks an attempt as permanently failed after ai-service exhausts retries.
type Command struct {
	AttemptID string
	Reason    *string
}

// Validate checks required fields.
func (c Command) Validate() error {
	if c.AttemptID == "" {
		return fmt.Errorf("attempt_id required: %w", interviewmodel.ErrInvalidInput)
	}
	return nil
}
