package service

import (
	"context"
	"errors"
	"time"

	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	aiadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/ai"
	billingadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing"
	recommendationadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/recommendation"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/complete_evaluation"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/fail_evaluation"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/submit_attempt"
)

const defaultTrainingTaskLimit = 10

// StartSessionInput starts a company or training session.
type StartSessionInput struct {
	TemplateID *string
	Mode       interviewmodel.SessionMode
	CompanyID  *string
	Scope      interviewmodel.PracticeScope
}

// Service is interview runtime use cases.
type Service interface {
	StartInterviewSession(ctx context.Context, userID string, input StartSessionInput) (*interviewmodel.SessionDetail, error)
	GetInterviewSession(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionDetail, error)
	GetCurrentSessionState(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionState, error)
	GetSessionResults(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionResults, error)
	CancelSession(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, error)
	PauseSession(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, error)
	ResumeSession(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionDetail, error)
	GetActiveSession(ctx context.Context, userID string) (*interviewmodel.SessionDetail, error)
	SubmitAttempt(ctx context.Context, input SubmitAttemptInput) (*interviewmodel.Attempt, error)
	GetAttempt(ctx context.Context, userID, attemptID string) (*interviewmodel.Attempt, error)
	CompleteEvaluation(ctx context.Context, input CompleteEvaluationInput) (*interviewmodel.EvaluationSummary, error)
	FailEvaluation(ctx context.Context, input FailEvaluationInput) error
	ListRetryItems(ctx context.Context, userID string, status *interviewmodel.RetryItemStatus) ([]interviewmodel.RetryItem, error)
	StartRetrySession(ctx context.Context, userID string, retryItemIDs []string) (*interviewmodel.SessionDetail, error)
	SkipTask(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SessionTask, interviewmodel.Progress, error)
	DismissRetryItem(ctx context.Context, userID, retryItemID string) (*interviewmodel.RetryItem, error)
	ExpireStaleActiveSessions(ctx context.Context) (int64, error)
	GetSystemDesignWorkspace(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SystemDesignWorkspaceBundle, error)
	PatchSystemDesignWorkspace(ctx context.Context, in interviewmodel.PatchSystemDesignWorkspaceInput) (*interviewmodel.SystemDesignWorkspace, error)
	ListSystemDesignTurns(ctx context.Context, userID, sessionTaskID string) ([]interviewmodel.SystemDesignTurn, error)
	PostSystemDesignTurn(ctx context.Context, userID, sessionTaskID, content string) (*interviewmodel.SystemDesignTurn, *interviewmodel.SystemDesignTurn, error)
	RequestSystemDesignCheckpoint(ctx context.Context, userID, sessionTaskID string, diagramPNGBase64 *string) (*interviewmodel.SystemDesignTurn, error)
	SubmitSystemDesign(ctx context.Context, userID, sessionTaskID string, diagramPNGBase64 *string) (*interviewmodel.Attempt, error)
	GetAttemptInternal(ctx context.Context, attemptID string) (*interviewmodel.Attempt, error)
	GetEvaluationSummaryInternal(ctx context.Context, attemptID string) (*interviewmodel.EvaluationSummary, error)
	ListRetryItemsInternal(ctx context.Context, userID string, status *interviewmodel.RetryItemStatus) ([]interviewmodel.RetryItem, error)
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]interviewmodel.OutboxMessage, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id, errMsg string) error
}

// SubmitAttemptInput holds attempt submission data.
type SubmitAttemptInput struct {
	UserID        string
	SessionTaskID string
	AnswerText    *string
	Code          *string
	Language      *string
	Attachments   []interviewmodel.Attachment
}

// CompleteEvaluationInput holds evaluation completion data (ai-service / internal).
type CompleteEvaluationInput struct {
	AttemptID string
	Score     float64
	Passed    *bool
	Summary   *string
	Feedback  map[string]any
}

// FailEvaluationInput marks a permanently failed ai evaluation (internal).
type FailEvaluationInput struct {
	AttemptID string
	Reason    *string
}

func completeEvaluationCommand(in CompleteEvaluationInput) complete_evaluation.Command {
	return complete_evaluation.Command{
		AttemptID: in.AttemptID,
		Score:     in.Score,
		Passed:    in.Passed,
		Summary:   in.Summary,
		Feedback:  in.Feedback,
	}
}

type interviewService struct {
	repo           Repository
	content        contentadapter.Client
	billing        billingadapter.Client
	recommendation recommendationadapter.Client
	ai             aiadapter.Client
	events         eventsadapter.Publisher
	sessionTTL     time.Duration
	staleAfter     time.Duration
	trainingLimit  int

	// CQRS usecase handlers. Reference pattern: each write/read operation is its
	// own package; the service is a thin orchestrator that delegates to them.
	submitAttempt      *submit_attempt.Handler
	completeEvaluation *complete_evaluation.Handler
	failEvaluation     *fail_evaluation.Handler
}

// Deps holds service dependencies.
type Deps struct {
	Repo            Repository
	Content         contentadapter.Client
	Billing         billingadapter.Client
	Recommendation  recommendationadapter.Client
	AI              aiadapter.Client
	Events          eventsadapter.Publisher
	SessionTTL      time.Duration
	StaleAfter      time.Duration
	TrainingLimit   int
}

// New constructs interview service.
func New(deps Deps) Service {
	ttl := deps.SessionTTL
	if ttl <= 0 {
		ttl = 8 * time.Hour
	}
	limit := deps.TrainingLimit
	if limit <= 0 {
		limit = defaultTrainingTaskLimit
	}
	stale := deps.StaleAfter
	if stale <= 0 {
		stale = 45 * time.Minute
	}
	svc := &interviewService{
		repo:           deps.Repo,
		content:        deps.Content,
		billing:        deps.Billing,
		recommendation: deps.Recommendation,
		ai:             deps.AI,
		events:         deps.Events,
		sessionTTL:    ttl,
		staleAfter:    stale,
		trainingLimit: limit,
		submitAttempt: submit_attempt.New(deps.Repo, deps.Content, ttl),
	}
	// complete_evaluation borrows the service's shared scoring rules (also used
	// by SkipTask) via the SessionScorer port.
	svc.completeEvaluation = complete_evaluation.New(deps.Repo, svc)
	svc.failEvaluation = fail_evaluation.New(deps.Repo)
	return svc
}

func (s *interviewService) ensureSessionActive(session *interviewmodel.Session) error {
	if session.Status == interviewmodel.SessionStatusPaused {
		return ErrSessionPaused
	}
	if session.Status == interviewmodel.SessionStatusCancelled ||
		session.Status == interviewmodel.SessionStatusCompleted ||
		session.Status == interviewmodel.SessionStatusExpired {
		return ErrSessionClosed
	}
	return nil
}

func (s *interviewService) expireIfNeeded(ctx context.Context, session *interviewmodel.Session) error {
	if session.Status != interviewmodel.SessionStatusActive {
		return nil
	}
	if !s.isSessionStale(session) {
		return nil
	}
	return s.markSessionExpired(ctx, session)
}

func (s *interviewService) isSessionStale(session *interviewmodel.Session) bool {
	now := time.Now().UTC()
	if now.Sub(session.StartedAt) > s.sessionTTL {
		return true
	}
	if now.Sub(session.UpdatedAt) > s.staleAfter {
		return true
	}
	return false
}

func (s *interviewService) markSessionExpired(ctx context.Context, session *interviewmodel.Session) error {
	now := time.Now().UTC()
	session.Status = interviewmodel.SessionStatusExpired
	session.UpdatedAt = now
	if err := s.repo.UpdateSession(ctx, session); err != nil {
		return err
	}
	return ErrSessionClosed
}

// ExpireStaleActiveSessions closes idle or over-TTL active sessions (background worker).
func (s *interviewService) ExpireStaleActiveSessions(ctx context.Context) (int64, error) {
	now := time.Now().UTC()
	return s.repo.ExpireStaleActiveSessions(ctx, now.Add(-s.staleAfter), now.Add(-s.sessionTTL))
}

func (s *interviewService) expireStaleForUser(ctx context.Context, userID string) error {
	session, err := s.repo.GetActiveSessionForUser(ctx, userID)
	if err != nil {
		if errors.Is(err, interviewrepo.ErrNotFound) {
			return nil
		}
		return err
	}
	if !s.isSessionStale(session) {
		return nil
	}
	if session.Status != interviewmodel.SessionStatusActive {
		return nil
	}
	_ = s.markSessionExpired(ctx, session)
	return nil
}
