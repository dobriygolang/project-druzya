package app

import (
	"context"
	"fmt"

	billingadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing/grpc"
	aiadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/ai"
	aigrpc "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/ai/grpc"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	recommendationadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/recommendation"
	recommendationgrpc "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/recommendation/grpc"
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
	ContentClient       *contentadapter.GRPCClient
	BillingClient       billingadapter.Client
	RecommendationClient recommendationadapter.Client
	AIClient             aiadapter.Client
	billingConn         *billinggrpc.Client
	recommendationConn  *recommendationgrpc.Client
	aiConn              *aigrpc.Client
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

	var recommendationClient recommendationadapter.Client
	var recommendationConn *recommendationgrpc.Client
	if cfg.RecommendationGRPCAddr != "" {
		recommendationConn, err = recommendationgrpc.NewClient(ctx, cfg.RecommendationGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			if billingConn != nil {
				_ = billingConn.Close()
			}
			_ = contentClient.Close()
			pg.Close()
			return nil, fmt.Errorf("init recommendation client: %w", err)
		}
		recommendationClient = recommendationConn
	}

	var aiClient aiadapter.Client
	var aiConn *aigrpc.Client
	if cfg.AIGRPCAddr != "" {
		aiConn, err = aigrpc.NewClient(ctx, cfg.AIGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			if recommendationConn != nil {
				_ = recommendationConn.Close()
			}
			if billingConn != nil {
				_ = billingConn.Close()
			}
			_ = contentClient.Close()
			pg.Close()
			return nil, fmt.Errorf("init ai client: %w", err)
		}
		aiClient = aiConn
	}

	repo := interviewrepo.New(pg)
	svc := interviewservice.New(interviewservice.Deps{
		Repo:           repo,
		Content:        contentClient,
		Billing:        billingClient,
		Recommendation: recommendationClient,
		AI:             aiClient,
		Events:         events,
		SessionTTL:     cfg.SessionTTL,
		StaleAfter:     cfg.SessionStaleAfter,
		TrainingLimit:  cfg.TrainingLimit,
	})

	return &App{
		Config:               cfg,
		Logger:               log,
		Postgres:             pg,
		ContentClient:        contentClient,
		BillingClient:        billingClient,
		RecommendationClient: recommendationClient,
		AIClient:             aiClient,
		billingConn:          billingConn,
		recommendationConn:   recommendationConn,
		aiConn:               aiConn,
		JWT:                  jwtValidator,
		Service:              svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.aiConn != nil {
		_ = a.aiConn.Close()
	}
	if a.recommendationConn != nil {
		_ = a.recommendationConn.Close()
	}
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
