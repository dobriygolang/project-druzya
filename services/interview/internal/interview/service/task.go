package service

import (
	"context"
	"fmt"
	"time"

	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func (s *interviewService) SkipTask(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SessionTask, interviewmodel.Progress, error) {
	if userID == "" || sessionTaskID == "" {
		return nil, interviewmodel.Progress{}, fmt.Errorf("user_id and session_task_id required: %w", ErrInvalidInput)
	}

	var (
		sessionTask *interviewmodel.SessionTask
		progress    interviewmodel.Progress
	)

	err := s.repo.WithTx(ctx, func(txCtx context.Context) error {
		task, err := s.repo.GetSessionTaskForUser(txCtx, userID, sessionTaskID)
		if err != nil {
			return err
		}
		session, err := s.repo.GetSessionForUser(txCtx, userID, task.SessionID)
		if err != nil {
			return err
		}
		if err := s.expireIfNeeded(txCtx, session); err != nil {
			return err
		}
		if err := s.ensureSessionActive(session); err != nil {
			return err
		}
		switch task.Status {
		case interviewmodel.SessionTaskEvaluated, interviewmodel.SessionTaskSkipped:
			return fmt.Errorf("task already finished: %w", ErrConflict)
		case interviewmodel.SessionTaskSubmitted:
			return fmt.Errorf("task awaiting evaluation: %w", ErrConflict)
		case interviewmodel.SessionTaskAssigned:
		default:
			return fmt.Errorf("task cannot be skipped: %w", ErrInvalidInput)
		}

		now := time.Now().UTC()
		task.Status = interviewmodel.SessionTaskSkipped
		task.UpdatedAt = now
		if err := s.repo.UpdateSessionTask(txCtx, task); err != nil {
			return err
		}

		if _, err := s.recalculateScores(txCtx, session); err != nil {
			return err
		}

		sections, err := s.repo.ListSectionsBySession(txCtx, session.ID)
		if err != nil {
			return err
		}
		tasks, err := s.repo.ListTasksBySession(txCtx, session.ID)
		if err != nil {
			return err
		}

		sessionTask = task
		progress = computeProgress(sections, tasks)
		return nil
	})
	if err != nil {
		return nil, interviewmodel.Progress{}, err
	}

	_ = s.events.Publish(ctx, eventsadapter.Event{
		Name: eventsadapter.TaskSkipped,
		Payload: map[string]any{
			"session_task_id": sessionTask.ID,
			"session_id":      sessionTask.SessionID,
			"task_id":         sessionTask.TaskID,
			"user_id":         userID,
		},
	})

	return sessionTask, progress, nil
}
