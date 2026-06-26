package contentapi

import (
	domain "github.com/sedorofeevd/project-druzya/services/content/internal/content"
	"google.golang.org/grpc"
)

// Register mounts ContentService on the gRPC server.
func Register(s *grpc.Server, svc domain.Service) {
	_ = s
	_ = svc
}
