package identityapi

import (
	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/grpc"
)

// Register mounts IdentityService on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	identityv1.RegisterIdentityServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc authservice.Service, telegramBotToken string) *Implementation {
	impl := NewImplementation(svc, telegramBotToken)
	Register(s, impl)
	return impl
}
