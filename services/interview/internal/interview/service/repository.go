package service

import (
	"context"
	"time"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

// Repository is the persistence port used by interview use cases.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Repository --output=./mocks --outpkg=mocks --filename=repository.go
type Repository interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	CreateSessionBundle(ctx context.Context, bundle interviewrepo.SessionBundle) error
	CreateRetrySession(ctx context.Context, bundle interviewrepo.SessionBundle, retryItemIDs []string, at time.Time) error
	GetSessionByID(ctx context.Context, id string) (*interviewmodel.Session, error)
	GetSessionForUser(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, error)
	GetActiveSessionForUser(ctx context.Context, userID string) (*interviewmodel.Session, error)
	ExpireStaleActiveSessions(ctx context.Context, idleBefore, maxAgeBefore time.Time) (int64, error)
	UpdateSession(ctx context.Context, session *interviewmodel.Session) error
	ListSectionsBySession(ctx context.Context, sessionID string) ([]interviewmodel.SessionSection, error)
	UpdateSection(ctx context.Context, section *interviewmodel.SessionSection) error
	ListTasksBySession(ctx context.Context, sessionID string) ([]interviewmodel.SessionTask, error)
	GetSessionTaskByID(ctx context.Context, id string) (*interviewmodel.SessionTask, error)
	GetSessionTaskForUser(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SessionTask, error)
	UpdateSessionTask(ctx context.Context, task *interviewmodel.SessionTask) error
	CreateAttempt(ctx context.Context, attempt *interviewmodel.Attempt) error
	GetAttemptByID(ctx context.Context, id string) (*interviewmodel.Attempt, error)
	GetAttemptForUser(ctx context.Context, userID, attemptID string) (*interviewmodel.Attempt, error)
	UpdateAttempt(ctx context.Context, attempt *interviewmodel.Attempt) error
	CreateEvaluationSummary(ctx context.Context, summary *interviewmodel.EvaluationSummary) error
	GetEvaluationSummaryByAttemptID(ctx context.Context, attemptID string) (*interviewmodel.EvaluationSummary, error)
	ListEvaluationsBySession(ctx context.Context, sessionID string) ([]interviewmodel.EvaluationWithAttempt, error)
	CreateRetryItemIfAbsent(ctx context.Context, item *interviewmodel.RetryItem) (bool, error)
	ListRetryItems(ctx context.Context, userID string, status *interviewmodel.RetryItemStatus) ([]interviewmodel.RetryItem, error)
	GetRetryItemsByIDs(ctx context.Context, userID string, ids []string) ([]interviewmodel.RetryItem, error)
	GetRetryItemForUser(ctx context.Context, userID, retryItemID string) (*interviewmodel.RetryItem, error)
	ListPendingRetryItems(ctx context.Context, userID string) ([]interviewmodel.RetryItem, error)
	ListRetryItemsBySession(ctx context.Context, sessionID string) ([]interviewmodel.RetryItem, error)
	ListPendingRetryTaskIDsForUser(ctx context.Context, userID string) ([]string, error)
	UpdateRetryItem(ctx context.Context, item *interviewmodel.RetryItem) error
	InsertOutbox(ctx context.Context, eventName string, payload map[string]any) error
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]interviewmodel.OutboxMessage, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id string, errMsg string, retryDelay time.Duration) error
	GetSystemDesignWorkspace(ctx context.Context, sessionTaskID string) (*interviewmodel.SystemDesignWorkspace, error)
	CreateSystemDesignWorkspace(ctx context.Context, ws *interviewmodel.SystemDesignWorkspace) error
	PatchSystemDesignWorkspace(ctx context.Context, in interviewmodel.PatchSystemDesignWorkspaceInput) (*interviewmodel.SystemDesignWorkspace, error)
	ListSystemDesignTurns(ctx context.Context, sessionTaskID string, limit int) ([]interviewmodel.SystemDesignTurn, error)
	CreateSystemDesignTurn(ctx context.Context, turn *interviewmodel.SystemDesignTurn) error
}
