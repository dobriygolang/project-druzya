// Package submit_attempt is the reference CQRS command for the interview
// service: one operation = one package with a validated Command and a Handler
// that depends on consumer-side interfaces. New domains should mirror this shape.
package submit_attempt

import (
	"fmt"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// Command is the input to submit an attempt for a session task.
type Command struct {
	UserID        string
	SessionTaskID string
	AnswerText    *string
	Code          *string
	Language      *string
	Attachments   []interviewmodel.Attachment
}

// Validate checks required fields and that some answer payload is present.
func (c Command) Validate() error {
	if c.UserID == "" || c.SessionTaskID == "" {
		return fmt.Errorf("user_id and session_task_id required: %w", interviewmodel.ErrInvalidInput)
	}
	if !c.hasPayload() {
		return fmt.Errorf("answer required: %w", interviewmodel.ErrInvalidInput)
	}
	return nil
}

func (c Command) hasPayload() bool {
	if c.AnswerText != nil && *c.AnswerText != "" {
		return true
	}
	if c.Code != nil && *c.Code != "" {
		return true
	}
	return len(c.Attachments) > 0
}
