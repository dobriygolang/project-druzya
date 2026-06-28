package recommendationapi

import (
	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	recommendationservice "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service"
)

// Implementation implements Recommendation gRPC handlers.
type Implementation struct {
	recommendationv1.UnimplementedRecommendationServiceServer
	recommendationv1.UnimplementedRecommendationInternalServiceServer
	service recommendationservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc recommendationservice.Service) *Implementation {
	return &Implementation{service: svc}
}
