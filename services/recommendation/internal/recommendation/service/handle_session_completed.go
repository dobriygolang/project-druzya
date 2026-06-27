package service

import (
	"context"
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

func (s *recommendationService) HandleSessionCompleted(ctx context.Context, eventID string, event model.SessionCompletedEvent) error {
	processed, err := s.repo.IsEventProcessed(ctx, model.ConsumerSessionCompleted, eventID)
	if err != nil {
		return fmt.Errorf("check event processed: %w", err)
	}
	if processed {
		return nil
	}

	return s.repo.WithTx(ctx, func(txCtx context.Context) error {
		claimed, err := s.repo.ClaimEvent(txCtx, model.ConsumerSessionCompleted, eventID)
		if err != nil {
			return fmt.Errorf("claim event: %w", err)
		}
		if !claimed {
			return nil
		}

		if err := s.repo.EnsureUserProfile(txCtx, event.UserID); err != nil {
			return fmt.Errorf("ensure user profile: %w", err)
		}

		profile, err := s.repo.GetUserProfile(txCtx, event.UserID)
		if err != nil {
			return fmt.Errorf("get user profile: %w", err)
		}

		scores, err := s.repo.ListSkillScoresByUser(txCtx, event.UserID)
		if err != nil {
			return fmt.Errorf("list skill scores: %w", err)
		}

		if profile.ReadinessScore >= 80 {
			suggestedMode := event.Mode
			rec := model.Recommendation{
				UserID:      event.UserID,
				Type:        model.RecTypeTakeMockInterview,
				Priority:    model.PriorityMedium,
				Title:       "Take a mock interview",
				Description: fmt.Sprintf("Your readiness score is %d/100 — schedule a full mock interview to validate progress.", profile.ReadinessScore),
				Metadata: map[string]any{
					"session_id":     event.SessionID,
					"mode":           event.Mode,
					"suggested_mode": suggestedMode,
				},
			}
			if _, err := s.repo.InsertTakeMockRecommendation(txCtx, rec); err != nil {
				return fmt.Errorf("insert take_mock_interview: %w", err)
			}
		}

		if weak := weakestSkill(scores); weak != nil {
			skillKey := weak.SkillKey
			section := sectionLabelFromMode(event.Mode)
			rec := model.Recommendation{
				UserID:      event.UserID,
				Type:        model.RecTypePracticeSection,
				Priority:    priorityForScore(weak.Score),
				SkillKey:    &skillKey,
				Title:       fmt.Sprintf("Practice %s section", section),
				Description: fmt.Sprintf("After completing your %s session, focus on %s (score %d/100).", section, humanizeSkillKey(weak.SkillKey), weak.Score),
				Metadata: map[string]any{
					"session_id": event.SessionID,
					"mode":       event.Mode,
					"skill_key":  weak.SkillKey,
				},
			}
			if _, err := s.repo.InsertSpecialRecommendation(txCtx, rec); err != nil {
				return fmt.Errorf("insert practice_section after session: %w", err)
			}
		}

		return nil
	})
}
