package aiapi

import (
	"context"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/summary"
)

// GenerateProfileSummary returns an LLM-generated profile summary.
func (i *Implementation) GenerateProfileSummary(
	ctx context.Context,
	req *aiv1.GenerateProfileSummaryRequest,
) (*aiv1.GenerateProfileSummaryResponse, error) {
	if req.GetUserId() == "" {
		return nil, invalidArgument("user_id is required")
	}
	skills := make([]summary.SkillScore, 0, len(req.GetSkills()))
	for _, s := range req.GetSkills() {
		skills = append(skills, summary.SkillScore{
			SkillKey:   s.GetSkillKey(),
			Score:      int(s.GetScore()),
			Confidence: int(s.GetConfidence()),
		})
	}
	text, err := i.service.GenerateProfileSummary(ctx, req.GetUserId(), int(req.GetReadinessScore()), skills, req.GetLocale())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &aiv1.GenerateProfileSummaryResponse{Summary: text}, nil
}
