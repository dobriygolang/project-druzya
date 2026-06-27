package recommendationapi

import (
	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	recommendationservice "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service"
	"google.golang.org/grpc"
)

// Register mounts RecommendationService on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	recommendationv1.RegisterRecommendationServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc recommendationservice.Service) *Implementation {
	impl := NewImplementation(svc)
	Register(s, impl)
	return impl
}
