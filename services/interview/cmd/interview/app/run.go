package app

import (
	"context"
	"fmt"

	billingadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing/grpc"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/config"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
)

// App holds adapters and the domain service.
type App struct {
	Config        *config.Config
	Logger        logger.Logger
	Postgres      *interviewrepo.Pool
	ContentClient *contentadapter.GRPCClient
	BillingClient billingadapter.Client
	billingConn   *billinggrpc.Client
	JWT           *jwt.Validator
	Service       interviewservice.Service
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

	pg, err := interviewrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	contentClient, err := contentadapter.NewGRPCClient(ctx, cfg.ContentGRPCAddr)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("init content client: %w", err)
	}

	events := eventsadapter.NewLoggerPublisher(log)

	var billingClient billingadapter.Client
	var billingConn *billinggrpc.Client
	if cfg.BillingGRPCAddr != "" {
		billingConn, err = billinggrpc.NewClient(ctx, cfg.BillingGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			_ = contentClient.Close()
			pg.Close()
			return nil, fmt.Errorf("init billing client: %w", err)
		}
		billingClient = billingConn
	}

	repo := interviewrepo.New(pg)
	svc := interviewservice.New(interviewservice.Deps{
		Repo:          repo,
		Content:       contentClient,
		Billing:       billingClient,
		Events:        events,
		SessionTTL:    cfg.SessionTTL,
		TrainingLimit: cfg.TrainingLimit,
	})

	return &App{
		Config:        cfg,
		Logger:        log,
		Postgres:      pg,
		ContentClient: contentClient,
		BillingClient: billingClient,
		billingConn:   billingConn,
		JWT:           jwtValidator,
		Service:       svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.billingConn != nil {
		_ = a.billingConn.Close()
	}
	if a.ContentClient != nil {
		_ = a.ContentClient.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
