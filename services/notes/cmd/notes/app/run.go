package app

import (
	"context"
	"fmt"

	billingadapter "github.com/sedorofeevd/project-druzya/services/notes/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/notes/internal/adapter/billing/grpc"
	"github.com/sedorofeevd/project-druzya/services/notes/internal/config"
	notesrepo "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/repository"
	notesservice "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/service"
	"github.com/sedorofeevd/project-druzya/services/notes/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
)

type App struct {
	Config      *config.Config
	Logger      logger.Logger
	Postgres    *notesrepo.Pool
	JWT         *jwt.Validator
	Service     notesservice.Service
	billingConn *billinggrpc.Client
}

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
	pg, err := notesrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}
	repo := notesrepo.New(pg)

	billingClient := billingadapter.Noop()
	var billingConn *billinggrpc.Client
	if cfg.InternalAPIToken != "" {
		billingConn, err = billinggrpc.NewClient(ctx, cfg.BillingGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			pg.Close()
			return nil, fmt.Errorf("init billing client: %w", err)
		}
		billingClient = billingConn
	}

	svc := notesservice.New(notesservice.Deps{
		Repo:          repo,
		PublicBaseURL: cfg.PublicBaseURL,
		Billing:       billingClient,
	})
	return &App{
		Config:      cfg,
		Logger:      log,
		Postgres:    pg,
		JWT:         jwtValidator,
		Service:     svc,
		billingConn: billingConn,
	}, nil
}

func (a *App) Close() {
	if a.billingConn != nil {
		_ = a.billingConn.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
