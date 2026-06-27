// Package run_evaluation is the CQRS command that scores one interview attempt:
// it ensures the evaluation job, gates billing, runs the LLM judge, persists the
// model calls and reports the result back to interview-service. Mirrors the
// submit_attempt / complete_evaluation command shape.
package run_evaluation

import (
	"fmt"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

// Command identifies the attempt to evaluate.
type Command struct {
	AttemptID string
}

// Validate checks required fields.
func (c Command) Validate() error {
	if c.AttemptID == "" {
		return fmt.Errorf("attempt_id required: %w", evaluationmodel.ErrInvalidInput)
	}
	return nil
}
