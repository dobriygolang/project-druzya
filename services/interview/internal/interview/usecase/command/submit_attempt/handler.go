package submit_attempt

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

// Repository is the persistence port this command needs (consumer-side interface).
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Repository --output=./mocks --outpkg=mocks --filename=repository.go
type Repository interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	GetSessionTaskForUser(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SessionTask, error)
	GetSessionForUser(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, error)
	UpdateSession(ctx context.Context, session *interviewmodel.Session) error
	UpdateSessionTask(ctx context.Context, task *interviewmodel.SessionTask) error
	CreateAttempt(ctx context.Context, attempt *interviewmodel.Attempt) error
	InsertOutbox(ctx context.Context, eventName string, payload map[string]any) error
}

// ContentClient is the content-service port this command needs.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=ContentClient --output=./mocks --outpkg=mocks --filename=content_client.go
type ContentClient interface {
	GetTask(ctx context.Context, taskID string) (*contentadapter.Task, error)
}

// Handler submits an attempt: it validates the session/task state, persists the
// attempt, marks the task submitted and writes the attempt_submitted outbox
// event — all in one transaction so ai-service delivery is exactly consistent.
type Handler struct {
	repo       Repository
	content    ContentClient
	sessionTTL time.Duration
}

// New constructs the submit-attempt handler.
func New(repo Repository, content ContentClient, sessionTTL time.Duration) *Handler {
	if sessionTTL <= 0 {
		sessionTTL = 8 * time.Hour
	}
	return &Handler{repo: repo, content: content, sessionTTL: sessionTTL}
}

// Handle executes the command.
func (h *Handler) Handle(ctx context.Context, cmd Command) (*interviewmodel.Attempt, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}

	sessionTask, err := h.repo.GetSessionTaskForUser(ctx, cmd.UserID, cmd.SessionTaskID)
	if err != nil {
		return nil, err
	}
	session, err := h.repo.GetSessionForUser(ctx, cmd.UserID, sessionTask.SessionID)
	if err != nil {
		return nil, err
	}
	if err := h.expireIfNeeded(ctx, session); err != nil {
		return nil, err
	}
	if err := ensureSessionActive(session); err != nil {
		return nil, err
	}
	switch sessionTask.Status {
	case interviewmodel.SessionTaskEvaluated, interviewmodel.SessionTaskSkipped:
		return nil, fmt.Errorf("task already finished: %w", interviewrepo.ErrConflict)
	case interviewmodel.SessionTaskSubmitted:
		return nil, fmt.Errorf("attempt already submitted: %w", interviewrepo.ErrConflict)
	}

	if _, err := h.content.GetTask(ctx, sessionTask.TaskID); err != nil {
		return nil, mapContentError(err)
	}

	now := time.Now().UTC()
	attempt := &interviewmodel.Attempt{
		ID:            uuid.NewString(),
		UserID:        cmd.UserID,
		SessionTaskID: sessionTask.ID,
		TaskID:        sessionTask.TaskID,
		AnswerText:    cmd.AnswerText,
		Code:          cmd.Code,
		Language:      cmd.Language,
		Attachments:   encodeAttachments(cmd.Attachments),
		Status:        interviewmodel.AttemptStatusEvaluating,
		SubmittedAt:   now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	err = h.repo.WithTx(ctx, func(txCtx context.Context) error {
		if err := h.repo.CreateAttempt(txCtx, attempt); err != nil {
			return err
		}
		sessionTask.Status = interviewmodel.SessionTaskSubmitted
		sessionTask.UpdatedAt = now
		if err := h.repo.UpdateSessionTask(txCtx, sessionTask); err != nil {
			return err
		}
		return h.repo.InsertOutbox(txCtx, string(eventsadapter.AttemptSubmitted),
			attemptSubmittedPayload(attempt, session.ID, sessionTask.ID, now))
	})
	if err != nil {
		return nil, err
	}
	return attempt, nil
}

func (h *Handler) expireIfNeeded(ctx context.Context, session *interviewmodel.Session) error {
	if session.Status != interviewmodel.SessionStatusActive {
		return nil
	}
	if time.Since(session.StartedAt) <= h.sessionTTL {
		return nil
	}
	now := time.Now().UTC()
	session.Status = interviewmodel.SessionStatusExpired
	session.UpdatedAt = now
	if err := h.repo.UpdateSession(ctx, session); err != nil {
		return err
	}
	return interviewmodel.ErrSessionClosed
}

func ensureSessionActive(session *interviewmodel.Session) error {
	switch session.Status {
	case interviewmodel.SessionStatusCancelled,
		interviewmodel.SessionStatusCompleted,
		interviewmodel.SessionStatusExpired:
		return interviewmodel.ErrSessionClosed
	}
	return nil
}

func mapContentError(err error) error {
	if errors.Is(err, contentadapter.ErrNotFound) {
		return fmt.Errorf("%w", interviewrepo.ErrNotFound)
	}
	return err
}

func encodeAttachments(items []interviewmodel.Attachment) json.RawMessage {
	if len(items) == 0 {
		return json.RawMessage("[]")
	}
	b, err := json.Marshal(items)
	if err != nil {
		return json.RawMessage("[]")
	}
	return b
}

func attemptSubmittedPayload(attempt *interviewmodel.Attempt, sessionID, sessionTaskID string, occurredAt time.Time) map[string]any {
	return map[string]any{
		"attempt_id":      attempt.ID,
		"user_id":         attempt.UserID,
		"task_id":         attempt.TaskID,
		"session_id":      sessionID,
		"session_task_id": sessionTaskID,
		"occurred_at":     occurredAt.Format(time.RFC3339Nano),
	}
}
