package service

import (
	"context"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/submit_attempt"
)

// SubmitAttempt delegates to the submit_attempt CQRS command handler.
func (s *interviewService) SubmitAttempt(ctx context.Context, input SubmitAttemptInput) (*interviewmodel.Attempt, error) {
	return s.submitAttempt.Handle(ctx, submit_attempt.Command{
		UserID:        input.UserID,
		SessionTaskID: input.SessionTaskID,
		AnswerText:    input.AnswerText,
		Code:          input.Code,
		Language:      input.Language,
		Attachments:   input.Attachments,
	})
}

func (s *interviewService) GetAttempt(ctx context.Context, userID, attemptID string) (*interviewmodel.Attempt, error) {
	return s.repo.GetAttemptForUser(ctx, userID, attemptID)
}
