package contentapi

import (
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
	catalogservice "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/service"
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	"google.golang.org/grpc"
)

// Register mounts ContentService on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	contentv1.RegisterContentServiceServer(s, impl)
	contentv1.RegisterContentAdminServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc catalogservice.Service, pg *catalogrepo.Pool) *Implementation {
	impl := NewImplementation(svc, pg)
	Register(s, impl)
	return impl
}
