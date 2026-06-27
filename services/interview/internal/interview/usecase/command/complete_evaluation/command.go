// Package complete_evaluation is the CQRS command invoked by ai-service to
// record an attempt's evaluation: it persists the summary, advances task/section
// state, enqueues a retry on failure and writes the durable outbox events — all
// in one transaction. Mirrors the submit_attempt command shape.
package complete_evaluation

import (
	"fmt"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// Command carries the evaluation result for an attempt.
type Command struct {
	AttemptID string
	Score     float64
	Passed    *bool
	Summary   *string
	Feedback  map[string]any
}

// Validate checks required fields.
func (c Command) Validate() error {
	if c.AttemptID == "" {
		return fmt.Errorf("attempt_id required: %w", interviewmodel.ErrInvalidInput)
	}
	return nil
}
