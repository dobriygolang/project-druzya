package identityapi

import (
	"context"

	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/user/model"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
)

// Service is the transport-facing identity API contract.
type Service interface {
	AuthTelegram(ctx context.Context, code string) (*authservice.AuthResult, error)
	GetYandexAuthURL(ctx context.Context, linkUserID string) (url, state string, err error)
	HandleYandexCallback(ctx context.Context, code, state string) (redirectURL string, err error)
	ExchangeYandexCode(ctx context.Context, exchangeCode string) (*authservice.AuthResult, error)
	RefreshToken(ctx context.Context, refreshToken string) (*authservice.AuthResult, error)
	Logout(ctx context.Context, refreshToken string) error
	GetMe(ctx context.Context, userID string) (*model.User, error)
	LinkYandex(ctx context.Context, userID, code string) (*model.User, error)
	GetUser(ctx context.Context, id string) (*model.User, error)
	GetUserByTelegramID(ctx context.Context, telegramID int64) (*model.User, error)
	ValidateToken(ctx context.Context, accessToken string) (string, error)
}

// Implementation implements IdentityService gRPC handlers.
type Implementation struct {
	identityv1.UnimplementedIdentityServiceServer
	service Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(service Service) *Implementation {
	return &Implementation{service: service}
}
