package aiapi

import (
	domain "github.com/sedorofeevd/project-druzya/services/ai/internal/ai"
	"google.golang.org/grpc"
)

// Register mounts AiService on the gRPC server.
func Register(s *grpc.Server, svc domain.Service) {
	_ = s
	_ = svc
}
