package app

import (
	"context"
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	interviewgrpc "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview/grpc"
	aiadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/ai"
	aigrpc "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/ai/grpc"
	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	trackergrpc "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker/grpc"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/config"
	recommendationrepo "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/repository"
	recommendationservice "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
)

// App holds adapters and the domain service.
type App struct {
	Config          *config.Config
	Logger          logger.Logger
	Postgres        *recommendationrepo.Pool
	JWT             *jwt.Validator
	InterviewClient interviewadapter.Client
	ContentClient   contentadapter.Client
	TrackerClient   trackeradapter.Client
	AIClient        aiadapter.Client
	interviewConn   *interviewgrpc.Client
	contentConn     *contentadapter.GRPCClient
	trackerConn     *trackergrpc.Client
	aiConn          *aigrpc.Client
	Service         recommendationservice.Service
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

	pg, err := recommendationrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	interviewClient, err := interviewgrpc.NewClient(ctx, cfg.InterviewGRPCAddr, cfg.InternalAPIToken)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("init interview client: %w", err)
	}

	contentClient, err := contentadapter.NewGRPCClient(ctx, cfg.ContentGRPCAddr)
	if err != nil {
		_ = interviewClient.Close()
		pg.Close()
		return nil, fmt.Errorf("init content client: %w", err)
	}

	var trackerClient trackeradapter.Client
	var trackerConn *trackergrpc.Client
	if cfg.TrackerGRPCAddr != "" {
		trackerConn, err = trackergrpc.NewClient(ctx, cfg.TrackerGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			_ = contentClient.Close()
			_ = interviewClient.Close()
			pg.Close()
			return nil, fmt.Errorf("init tracker client: %w", err)
		}
		trackerClient = trackerConn
	}

	var aiClient aiadapter.Client
	var aiConn *aigrpc.Client
	if cfg.AIGRPCAddr != "" {
		aiConn, err = aigrpc.NewClient(ctx, cfg.AIGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			if trackerConn != nil {
				_ = trackerConn.Close()
			}
			_ = contentClient.Close()
			_ = interviewClient.Close()
			pg.Close()
			return nil, fmt.Errorf("init ai client: %w", err)
		}
		aiClient = aiConn
	}

	repo := recommendationrepo.New(pg)
	svc := recommendationservice.New(recommendationservice.Deps{
		Repo:      repo,
		Interview: interviewClient,
		Content:   contentClient,
		Tracker:   trackerClient,
		AI:        aiClient,
	})

	return &App{
		Config:          cfg,
		Logger:          log,
		Postgres:        pg,
		JWT:             jwtValidator,
		InterviewClient: interviewClient,
		ContentClient:   contentClient,
		TrackerClient:   trackerClient,
		AIClient:        aiClient,
		interviewConn:   interviewClient,
		contentConn:     contentClient,
		trackerConn:     trackerConn,
		aiConn:          aiConn,
		Service:         svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.contentConn != nil {
		_ = a.contentConn.Close()
	}
	if a.trackerConn != nil {
		_ = a.trackerConn.Close()
	}
	if a.aiConn != nil {
		_ = a.aiConn.Close()
	}
	if a.interviewConn != nil {
		_ = a.interviewConn.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
