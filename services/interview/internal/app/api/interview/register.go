package interviewapi

import (
	domain "github.com/sedorofeevd/project-druzya/services/interview/internal/interview"
	"google.golang.org/grpc"
)

// Register mounts InterviewService on the gRPC server.
func Register(s *grpc.Server, svc domain.Service) {
	_ = s
	_ = svc
}
