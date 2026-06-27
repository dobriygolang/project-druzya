package sandboxapi

import (
	sandboxservice "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/service"
	sandboxv1 "github.com/sedorofeevd/project-druzya/services/sandbox/pkg/api/sandbox/v1"
	"google.golang.org/grpc"
)

// Implementation serves sandbox gRPC/HTTP APIs.
type Implementation struct {
	sandboxv1.UnimplementedSandboxServiceServer
	svc sandboxservice.Service
}

// NewImplementation constructs transport handlers.
func NewImplementation(svc sandboxservice.Service) *Implementation {
	return &Implementation{svc: svc}
}

// Register mounts sandbox services on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	sandboxv1.RegisterSandboxServiceServer(s, impl)
}
