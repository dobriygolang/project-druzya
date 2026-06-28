package adminapi

import (
	adminservice "github.com/sedorofeevd/project-druzya/services/admin/internal/admin/service"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
	"google.golang.org/grpc"
)

// Implementation is the admin BFF transport layer.
type Implementation struct {
	adminv1.UnimplementedAdminServiceServer
	service adminservice.Service
}

// NewImplementation constructs transport handlers.
func NewImplementation(svc adminservice.Service) *Implementation {
	return &Implementation{service: svc}
}

// NewRegisteredImplementation registers AdminService on gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc adminservice.Service) *Implementation {
	impl := NewImplementation(svc)
	adminv1.RegisterAdminServiceServer(s, impl)
	return impl
}
