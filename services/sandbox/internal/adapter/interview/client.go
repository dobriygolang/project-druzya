package interview

import "context"

// SubmitAttemptInput holds attempt submission data.
type SubmitAttemptInput struct {
	SessionTaskID string
	AnswerText    *string
	Code          *string
	Language      *string
}

// SubmitAttemptResult is returned after submitting an attempt.
type SubmitAttemptResult struct {
	AttemptID string
	Status    string
}

// Client submits interview attempts on behalf of the authenticated user.
type Client interface {
	SubmitAttempt(ctx context.Context, bearerToken string, input SubmitAttemptInput) (*SubmitAttemptResult, error)
	Ping(ctx context.Context) error
}
