package fail_evaluation

import (
	"context"
	"fmt"
	"time"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

// Repository is the persistence port this command needs.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Repository --output=./mocks --outpkg=mocks --filename=repository.go
type Repository interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	GetAttemptByID(ctx context.Context, id string) (*interviewmodel.Attempt, error)
	UpdateAttempt(ctx context.Context, attempt *interviewmodel.Attempt) error
	GetSessionTaskByID(ctx context.Context, id string) (*interviewmodel.SessionTask, error)
	UpdateSessionTask(ctx context.Context, task *interviewmodel.SessionTask) error
}

// Handler marks a stuck attempt as failed and reopens the task for retry.
type Handler struct {
	repo Repository
}

// New constructs the fail-evaluation handler.
func New(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// Handle executes the command. Idempotent when the attempt is already failed.
func (h *Handler) Handle(ctx context.Context, cmd Command) error {
	if err := cmd.Validate(); err != nil {
		return err
	}

	return h.repo.WithTx(ctx, func(txCtx context.Context) error {
		attempt, err := h.repo.GetAttemptByID(txCtx, cmd.AttemptID)
		if err != nil {
			return err
		}
		if attempt.Status == interviewmodel.AttemptStatusFailed {
			return nil
		}
		if attempt.Status == interviewmodel.AttemptStatusEvaluated {
			return fmt.Errorf("attempt already evaluated: %w", interviewrepo.ErrConflict)
		}
		if attempt.Status != interviewmodel.AttemptStatusEvaluating {
			return fmt.Errorf("attempt not evaluating: %w", interviewrepo.ErrConflict)
		}

		sessionTask, err := h.repo.GetSessionTaskByID(txCtx, attempt.SessionTaskID)
		if err != nil {
			return err
		}

		now := time.Now().UTC()
		attempt.Status = interviewmodel.AttemptStatusFailed
		attempt.UpdatedAt = now
		if err := h.repo.UpdateAttempt(txCtx, attempt); err != nil {
			return err
		}

		if sessionTask.Status == interviewmodel.SessionTaskSubmitted {
			sessionTask.Status = interviewmodel.SessionTaskAssigned
			sessionTask.UpdatedAt = now
			if err := h.repo.UpdateSessionTask(txCtx, sessionTask); err != nil {
				return err
			}
		}
		return nil
	})
}
