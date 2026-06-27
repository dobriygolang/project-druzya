package billingapi

import (
	billingservice "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/service"
	"google.golang.org/grpc"
)

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc billingservice.Service) *Implementation {
	impl := NewImplementation(svc)
	Register(s, impl)
	return impl
}
