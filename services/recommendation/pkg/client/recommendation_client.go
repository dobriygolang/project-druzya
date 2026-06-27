package client

import (
	"context"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

// Service is the recommendation domain port for other services.
type Service interface {
	GetDashboard(ctx context.Context, userID string) (*model.Dashboard, error)
	DismissRecommendation(ctx context.Context, userID, id string) error
	CompleteRecommendation(ctx context.Context, userID, id string) error
	CompleteLearningPlanItem(ctx context.Context, userID, id string) error
	DismissLearningPlanItem(ctx context.Context, userID, id string) error
}
