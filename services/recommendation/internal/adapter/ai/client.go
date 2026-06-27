package ai

import "context"

// SkillScore is a skill metric for profile summary.
type SkillScore struct {
	SkillKey   string
	Score      int
	Confidence int
}

// Client calls ai-service internal RPCs.
type Client interface {
	GenerateProfileSummary(ctx context.Context, userID string, readiness int, skills []SkillScore) (string, error)
}
