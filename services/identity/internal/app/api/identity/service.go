package identityapi

import (
	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
	userrepo "github.com/sedorofeevd/project-druzya/services/identity/internal/user/repository"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
)

// Implementation implements IdentityService gRPC handlers. It depends directly
// on the domain service interface (no duplicate transport-side contract).
type Implementation struct {
	identityv1.UnimplementedIdentityServiceServer
	service          authservice.Service
	users            *userrepo.Repository
	pg               *userrepo.Pool
	telegramBotToken string
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(service authservice.Service, users *userrepo.Repository, pg *userrepo.Pool, telegramBotToken string) *Implementation {
	return &Implementation{service: service, users: users, pg: pg, telegramBotToken: telegramBotToken}
}
