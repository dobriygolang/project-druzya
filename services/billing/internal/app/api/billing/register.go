package billingapi

import (
	domain "github.com/sedorofeevd/project-druzya/services/billing/internal/billing"
	"google.golang.org/grpc"
)

// Register mounts BillingService on the gRPC server.
func Register(s *grpc.Server, svc domain.Service) {
	_ = s
	_ = svc
}
