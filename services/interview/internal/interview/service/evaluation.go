package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/shopspring/decimal"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// CompleteEvaluation delegates to the complete_evaluation CQRS command handler.
func (s *interviewService) CompleteEvaluation(ctx context.Context, input CompleteEvaluationInput) (*interviewmodel.EvaluationSummary, error) {
	return s.completeEvaluation.Handle(ctx, completeEvaluationCommand(input))
}

// RecalculateScores satisfies the complete_evaluation.SessionScorer port; the
// scoring rules are shared with SkipTask, so they stay in the domain service.
func (s *interviewService) RecalculateScores(ctx context.Context, session *interviewmodel.Session) (bool, error) {
	return s.recalculateScores(ctx, session)
}

func (s *interviewService) recalculateScores(ctx context.Context, session *interviewmodel.Session) (bool, error) {
	evals, err := s.repo.ListEvaluationsBySession(ctx, session.ID)
	if err != nil {
		return false, err
	}

	sectionScores := map[string][]decimal.Decimal{}
	taskScores := make([]decimal.Decimal, 0, len(evals))
	for _, ev := range evals {
		taskScores = append(taskScores, ev.Summary.Score)
		sectionScores[ev.SectionID] = append(sectionScores[ev.SectionID], ev.Summary.Score)
	}

	sections, err := s.repo.ListSectionsBySession(ctx, session.ID)
	if err != nil {
		return false, err
	}
	tasks, err := s.repo.ListTasksBySession(ctx, session.ID)
	if err != nil {
		return false, err
	}

	now := time.Now().UTC()
	for i := range sections {
		scores := sectionScores[sections[i].ID]
		// Only set an average when there are scored tasks, but still evaluate
		// completion below: a section whose tasks were all skipped has no scores
		// yet must be marked completed so the next section activates.
		if len(scores) > 0 {
			avg := averageDecimal(scores)
			sections[i].Score = &avg
		}
		if sectionTasksDone(tasks, sections[i].ID) {
			sections[i].Status = interviewmodel.SectionStatusCompleted
			if i+1 < len(sections) && sections[i+1].Status == interviewmodel.SectionStatusPending {
				sections[i+1].Status = interviewmodel.SectionStatusActive
				sections[i+1].UpdatedAt = now
				if err := s.repo.UpdateSection(ctx, &sections[i+1]); err != nil {
					return false, err
				}
			}
		}
		sections[i].UpdatedAt = now
		if err := s.repo.UpdateSection(ctx, &sections[i]); err != nil {
			return false, err
		}
	}

	if len(taskScores) > 0 {
		total := averageDecimal(taskScores)
		session.TotalScore = &total
	}

	sessionCompleted := false
	if allTasksDone(tasks) {
		sessionCompleted = true
		session.Status = interviewmodel.SessionStatusCompleted
		completedAt := now
		session.CompletedAt = &completedAt
		if session.Mode == interviewmodel.ModeRetryMistakes {
			if err := s.resolveRetryItemsForSession(ctx, session.ID, now); err != nil {
				return false, err
			}
		}
	}
	session.UpdatedAt = now
	if err := s.repo.UpdateSession(ctx, session); err != nil {
		return false, err
	}
	return sessionCompleted, nil
}

func sectionTasksDone(tasks []interviewmodel.SessionTask, sectionID string) bool {
	hasTask := false
	for _, t := range tasks {
		if t.SectionID != sectionID {
			continue
		}
		hasTask = true
		switch t.Status {
		case interviewmodel.SessionTaskEvaluated, interviewmodel.SessionTaskSkipped:
			continue
		default:
			return false
		}
	}
	return hasTask
}

func averageDecimal(values []decimal.Decimal) decimal.Decimal {
	if len(values) == 0 {
		return decimal.Zero
	}
	sum := decimal.Zero
	for _, v := range values {
		sum = sum.Add(v)
	}
	return sum.Div(decimal.NewFromInt(int64(len(values))))
}

func (s *interviewService) resolveRetryItemsForSession(ctx context.Context, sessionID string, now time.Time) error {
	items, err := s.repo.ListRetryItemsBySession(ctx, sessionID)
	if err != nil {
		return err
	}
	for i := range items {
		if items[i].SessionID == nil || *items[i].SessionID != sessionID {
			continue
		}
		items[i].Status = interviewmodel.RetryStatusCompleted
		items[i].ResolvedAt = &now
		items[i].UpdatedAt = now
		if err := s.repo.UpdateRetryItem(ctx, &items[i]); err != nil {
			return err
		}
	}
	return nil
}

func mapContentError(err error) error {
	if errors.Is(err, contentadapter.ErrNotFound) {
		return fmt.Errorf("%w", ErrNotFound)
	}
	return err
}
