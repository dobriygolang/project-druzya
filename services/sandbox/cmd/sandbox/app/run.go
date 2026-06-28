package app

import (
	"context"
	"fmt"

	contentgrpc "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/content/grpc"
	billingadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing/grpc"
	interviewgrpc "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/interview/grpc"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/runner"
	sandboxrepo "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/repository"
	sandboxservice "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/service"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/config"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
)

// App holds adapters and the domain service.
type App struct {
	Config        *config.Config
	Logger        logger.Logger
	Postgres      *sandboxrepo.Pool
	JWT           *jwt.Validator
	ContentConn   *contentgrpc.Client
	InterviewConn *interviewgrpc.Client
	BillingConn   *billinggrpc.Client
	Service       sandboxservice.Service
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

	pg, err := sandboxrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	contentClient, err := contentgrpc.NewClient(ctx, cfg.ContentGRPCAddr)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("init content client: %w", err)
	}

	interviewClient, err := interviewgrpc.NewClient(ctx, cfg.InterviewGRPCAddr)
	if err != nil {
		_ = contentClient.Close()
		pg.Close()
		return nil, fmt.Errorf("init interview client: %w", err)
	}

	codeRunner, err := runner.NewFromConfig(cfg)
	if err != nil {
		_ = interviewClient.Close()
		_ = contentClient.Close()
		pg.Close()
		return nil, fmt.Errorf("init runner: %w", err)
	}
	if cfg.RunnerMode == "docker" {
		runner.WarmDockerImages(ctx, log,
			cfg.DockerGoImage,
			cfg.DockerPythonImage,
			cfg.DockerNodeImage,
		)
	}

	var billingClient billingadapter.Client
	var billingConn *billinggrpc.Client
	if cfg.BillingGRPCAddr != "" {
		if cfg.InternalAPIToken == "" {
			_ = interviewClient.Close()
			_ = contentClient.Close()
			pg.Close()
			return nil, fmt.Errorf("INTERNAL_API_TOKEN is required when BILLING_GRPC_ADDR is set")
		}
		billingConn, err = billinggrpc.NewClient(ctx, cfg.BillingGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			_ = interviewClient.Close()
			_ = contentClient.Close()
			pg.Close()
			return nil, fmt.Errorf("init billing client: %w", err)
		}
		billingClient = billingConn
	}

	repo := sandboxrepo.New(pg)
	svc := sandboxservice.New(sandboxservice.Deps{
		Repo:      repo,
		Content:   contentClient,
		Interview: interviewClient,
		Billing:   billingClient,
		Runner:        codeRunner,
		TimeoutMS:     cfg.DefaultTimeoutMS,
		MemoryMB:      cfg.DefaultMemoryMB,
		MaxCodeBytes:  cfg.MaxCodeBytes,
		MaxStdinBytes: cfg.MaxStdinBytes,
		AsyncRuns:     cfg.AsyncRuns,
	})

	return &App{
		Config:        cfg,
		Logger:        log,
		Postgres:      pg,
		JWT:           jwtValidator,
		ContentConn:   contentClient,
		InterviewConn: interviewClient,
		BillingConn:   billingConn,
		Service:       svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.BillingConn != nil {
		_ = a.BillingConn.Close()
	}
	if a.InterviewConn != nil {
		_ = a.InterviewConn.Close()
	}
	if a.ContentConn != nil {
		_ = a.ContentConn.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
