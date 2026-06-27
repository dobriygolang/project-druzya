package app

import (
	"context"
	"fmt"

	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
	authrepo "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/repository"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/adapter/yandex"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/config"
	userrepo "github.com/sedorofeevd/project-druzya/services/identity/internal/user/repository"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/tools/logger"
)

// App holds adapters and the domain service for identity.
type App struct {
	Config       *config.Config
	Logger       logger.Logger
	Postgres     *userrepo.Pool
	Redis        *authrepo.Client
	Service      authservice.Service
	TokenManager *authservice.TokenManager
	PublicKeyPEM []byte
}

// New wires adapters and the domain service.
func New(ctx context.Context) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}

	log, err := logger.New(cfg.LogLevel)
	if err != nil {
		return nil, fmt.Errorf("init logger: %w", err)
	}

	pg, err := userrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	redisClient, err := authrepo.New(ctx, cfg.RedisAddr)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("init redis: %w", err)
	}

	tokenManager, err := authservice.NewTokenManager(
		cfg.JWTPrivateKeyPEM,
		cfg.JWTPublicKeyPEM,
		cfg.JWTAccessTTL,
		cfg.JWTRefreshTTL,
	)
	if err != nil {
		_ = redisClient.Close()
		pg.Close()
		return nil, fmt.Errorf("init token manager: %w", err)
	}

	publicKeyPEM, err := tokenManager.PublicKeyPEM()
	if err != nil {
		_ = redisClient.Close()
		pg.Close()
		return nil, fmt.Errorf("encode public key: %w", err)
	}

	a := &App{
		Config:       cfg,
		Logger:       log,
		Postgres:     pg,
		Redis:        redisClient,
		TokenManager: tokenManager,
		PublicKeyPEM: publicKeyPEM,
	}

	a.Service = authservice.New(authservice.Deps{
		Users:         userrepo.New(pg),
		LoginCodes:    authrepo.NewLoginCodeRepository(redisClient),
		RefreshTokens: authrepo.NewRefreshTokenRepository(redisClient),
		OAuthStates:   authrepo.NewOAuthStateRepository(redisClient),
		ExchangeCodes: authrepo.NewExchangeCodeRepository(redisClient),
		Yandex:        yandex.NewClient(cfg.YandexClientID, cfg.YandexClientSecret, cfg.YandexRedirectURI),
		Tokens:        tokenManager,
		FrontendURL:   cfg.FrontendURL,
		Log:           log,
	})

	return a, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.Redis != nil {
		_ = a.Redis.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
