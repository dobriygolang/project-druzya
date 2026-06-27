package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
)

// CompleteRecommendation marks a recommendation as completed.
func (i *Implementation) CompleteRecommendation(ctx context.Context, req *recommendationv1.CompleteRecommendationRequest) (*recommendationv1.CompleteRecommendationResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}
	if err := i.service.CompleteRecommendation(ctx, userID, req.GetId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &recommendationv1.CompleteRecommendationResponse{}, nil
}
