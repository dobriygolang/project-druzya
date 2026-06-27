package interviewapi

import (
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	"google.golang.org/grpc"
)

// Register mounts Interview services on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	interviewv1.RegisterInterviewServiceServer(s, impl)
	interviewv1.RegisterInterviewInternalServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc interviewservice.Service) *Implementation {
	impl := NewImplementation(svc)
	Register(s, impl)
	return impl
}
