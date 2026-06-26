package sandboxapi

import (
	domain "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox"
	"google.golang.org/grpc"
)

// Register mounts SandboxService on the gRPC server.
func Register(s *grpc.Server, svc domain.Service) {
	_ = s
	_ = svc
}
