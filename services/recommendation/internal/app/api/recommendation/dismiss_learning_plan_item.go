package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
)

// DismissLearningPlanItem marks a learning plan item as dismissed.
func (i *Implementation) DismissLearningPlanItem(ctx context.Context, req *recommendationv1.DismissLearningPlanItemRequest) (*recommendationv1.DismissLearningPlanItemResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}
	if err := i.service.DismissLearningPlanItem(ctx, userID, req.GetId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &recommendationv1.DismissLearningPlanItemResponse{}, nil
}
