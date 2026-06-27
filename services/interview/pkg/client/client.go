package client

import (
	"context"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
)

// Client is the user-facing interview API port for other services.
type Client interface {
	StartInterviewSession(ctx context.Context, userID string, templateID *string, mode interviewmodel.SessionMode) (*interviewmodel.SessionDetail, error)
	GetInterviewSession(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionDetail, error)
	GetCurrentSessionState(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionState, error)
	GetSessionResults(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionResults, error)
	CancelSession(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, error)
	SubmitAttempt(ctx context.Context, input interviewservice.SubmitAttemptInput) (*interviewmodel.Attempt, error)
	GetAttempt(ctx context.Context, userID, attemptID string) (*interviewmodel.Attempt, error)
	ListRetryItems(ctx context.Context, userID string, status *interviewmodel.RetryItemStatus) ([]interviewmodel.RetryItem, error)
	StartRetrySession(ctx context.Context, userID string, retryItemIDs []string) (*interviewmodel.SessionDetail, error)
	SkipTask(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SessionTask, interviewmodel.Progress, error)
	DismissRetryItem(ctx context.Context, userID, retryItemID string) (*interviewmodel.RetryItem, error)
}
