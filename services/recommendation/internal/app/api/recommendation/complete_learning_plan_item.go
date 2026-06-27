package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
)

// CompleteLearningPlanItem marks a learning plan item as completed.
func (i *Implementation) CompleteLearningPlanItem(ctx context.Context, req *recommendationv1.CompleteLearningPlanItemRequest) (*recommendationv1.CompleteLearningPlanItemResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}
	if err := i.service.CompleteLearningPlanItem(ctx, userID, req.GetId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &recommendationv1.CompleteLearningPlanItemResponse{}, nil
}
