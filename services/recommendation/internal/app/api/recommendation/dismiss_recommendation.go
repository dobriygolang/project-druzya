package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
)

// DismissRecommendation marks a recommendation as dismissed.
func (i *Implementation) DismissRecommendation(ctx context.Context, req *recommendationv1.DismissRecommendationRequest) (*recommendationv1.DismissRecommendationResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}
	if err := i.service.DismissRecommendation(ctx, userID, req.GetId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &recommendationv1.DismissRecommendationResponse{}, nil
}
