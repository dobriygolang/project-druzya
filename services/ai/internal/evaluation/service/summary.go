package service

import (
	"context"
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/summary"
)

// GenerateProfileSummary builds a human-readable skill profile summary.
func (s *evaluationService) GenerateProfileSummary(
	ctx context.Context,
	userID string,
	readiness int,
	skills []summary.SkillScore,
	locale string,
) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}
	gen := s.summary
	if gen == nil {
		gen = summary.New(nil)
	}
	return gen.Generate(ctx, summary.Input{
		UserID: userID, ReadinessScore: readiness, Skills: skills,
	}, locale)
}
