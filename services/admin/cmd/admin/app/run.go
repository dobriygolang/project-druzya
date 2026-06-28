package app

import (
	"context"
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	contentgrpc "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content/grpc"
	billingadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing/grpc"
	identityadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/identity"
	identitygrpc "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/identity/grpc"
	aiadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/ai"
	aigrpc "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/ai/grpc"
	adminservice "github.com/sedorofeevd/project-druzya/services/admin/internal/admin/service"
	"github.com/sedorofeevd/project-druzya/services/admin/internal/config"
	"github.com/sedorofeevd/project-druzya/services/admin/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
)

// App holds adapters and the domain service.
type App struct {
	Config        *config.Config
	Logger        logger.Logger
	JWT           *jwt.Validator
	ContentClient contentadapter.Client
	contentConn   *contentgrpc.Client
	IdentityClient identityadapter.Client
	identityConn   *identitygrpc.Client
	BillingClient billingadapter.Client
	billingConn   *billinggrpc.Client
	AIClient      aiadapter.Client
	aiConn        *aigrpc.Client
	Service       adminservice.Service
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

	contentClient, err := contentgrpc.NewClient(ctx, cfg.ContentGRPCAddr, cfg.ContentAdminToken)
	if err != nil {
		return nil, fmt.Errorf("init content client: %w", err)
	}

	identityClient, err := identitygrpc.NewClient(ctx, cfg.IdentityGRPCAddr, cfg.InternalAPIToken)
	if err != nil {
		_ = contentClient.Close()
		return nil, fmt.Errorf("init identity client: %w", err)
	}

	billingClient, err := billinggrpc.NewClient(ctx, cfg.BillingGRPCAddr, cfg.InternalAPIToken)
	if err != nil {
		_ = identityClient.Close()
		_ = contentClient.Close()
		return nil, fmt.Errorf("init billing client: %w", err)
	}

	aiClient, err := aigrpc.NewClient(ctx, cfg.AIGRPCAddr, cfg.InternalAPIToken)
	if err != nil {
		_ = billingClient.Close()
		_ = identityClient.Close()
		_ = contentClient.Close()
		return nil, fmt.Errorf("init ai client: %w", err)
	}

	svc := adminservice.New(adminservice.Deps{
		Identity: identityClient,
		Content:  contentClient,
		Billing:  billingClient,
		AI:       aiClient,
	})

	return &App{
		Config:         cfg,
		Logger:         log,
		JWT:            jwtValidator,
		ContentClient:  contentClient,
		contentConn:    contentClient,
		IdentityClient: identityClient,
		identityConn:   identityClient,
		BillingClient:  billingClient,
		billingConn:    billingClient,
		AIClient:       aiClient,
		aiConn:         aiClient,
		Service:        svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.contentConn != nil {
		_ = a.contentConn.Close()
	}
	if a.identityConn != nil {
		_ = a.identityConn.Close()
	}
	if a.billingConn != nil {
		_ = a.billingConn.Close()
	}
	if a.aiConn != nil {
		_ = a.aiConn.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
