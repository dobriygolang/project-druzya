package aiapi

import (
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	"google.golang.org/grpc"
)

// Register mounts AiInternalService on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	aiv1.RegisterAiInternalServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc evaluationservice.Service) *Implementation {
	impl := NewImplementation(svc)
	Register(s, impl)
	return impl
}
