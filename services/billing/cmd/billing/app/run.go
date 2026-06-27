package app

import (
	"context"
	"fmt"

	identitygrpc "github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/identity/grpc"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/providers/tribute"
	billingrepo "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
	billingservice "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/service"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/config"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
)

// App holds adapters and the domain service.
type App struct {
	Config        *config.Config
	Logger        logger.Logger
	Postgres      *billingrepo.Pool
	JWT           *jwt.Validator
	IdentityConn  *identitygrpc.Client
	Service       billingservice.Service
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

	jwtValidator, err := jwt.NewValidator(cfg.JWTPublicKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("init jwt validator: %w", err)
	}

	pg, err := billingrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	identityClient, err := identitygrpc.NewClient(ctx, cfg.IdentityGRPCAddr)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("init identity client: %w", err)
	}

	tributeProvider := tribute.New(tribute.Config{WebhookSecret: cfg.TributeWebhookSecret})
	repo := billingrepo.New(pg)
	svc := billingservice.New(billingservice.Deps{
		Repo:       repo,
		Identity:   identityClient,
		Providers:  []providers.BillingProvider{tributeProvider},
		TierToPlan: cfg.TributeTierToPlan,
	})

	return &App{
		Config:       cfg,
		Logger:       log,
		Postgres:     pg,
		JWT:          jwtValidator,
		IdentityConn: identityClient,
		Service:      svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.IdentityConn != nil {
		_ = a.IdentityConn.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
