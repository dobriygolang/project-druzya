package contentapi

import (
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	catalogservice "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/service"
	"google.golang.org/grpc"
)

// Register mounts ContentService on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	contentv1.RegisterContentServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc catalogservice.Service) *Implementation {
	impl := NewImplementation(svc)
	Register(s, impl)
	return impl
}
