package identityapi

import (
	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
)

// Implementation implements IdentityService gRPC handlers. It depends directly
// on the domain service interface (no duplicate transport-side contract).
type Implementation struct {
	identityv1.UnimplementedIdentityServiceServer
	service authservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(service authservice.Service) *Implementation {
	return &Implementation{service: service}
}
