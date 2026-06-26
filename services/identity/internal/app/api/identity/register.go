package identityapi

import (
	identityservice "github.com/sedorofeevd/project-druzya/services/identity/internal/identity/service"
	"google.golang.org/grpc"
)

// Register mounts IdentityService on the gRPC server.
// After `make gen-proto`, wire identityv1.RegisterIdentityServiceServer here.
func Register(s *grpc.Server, svc identityservice.Service) {
	_ = s
	_ = svc
}
