package app

import (
	"context"
	"fmt"
	"log/slog"

	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	contentgrpc "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content/grpc"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	interviewgrpc "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview/grpc"
	llmadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/config"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
)

// App holds adapters and the domain service.
type App struct {
	Config          *config.Config
	Logger          logger.Logger
	Postgres        *evaluationrepo.Pool
	InterviewClient interviewadapter.Client
	ContentClient   contentadapter.Client
	interviewConn   *interviewgrpc.Client
	contentConn     *contentgrpc.Client
	Service         evaluationservice.Service
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

	pg, err := evaluationrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	interviewClient, err := interviewgrpc.NewClient(ctx, cfg.InterviewGRPCAddr, cfg.InternalAPIToken)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("init interview client: %w", err)
	}

	contentClient, err := contentgrpc.NewClient(ctx, cfg.ContentGRPCAddr)
	if err != nil {
		_ = interviewClient.Close()
		pg.Close()
		return nil, fmt.Errorf("init content client: %w", err)
	}

	chain, err := llmadapter.BuildChain(llmadapter.BuildConfig{
		Order:    cfg.LLMChainOrder,
		OpenAI:   cfg.OpenAIAPIKey,
		Groq:     cfg.GroqAPIKey,
		Cerebras: cfg.CerebrasAPIKey,
		Google:   cfg.GoogleAPIKey,
		Caveman:  cfg.LLMCavemanLevel,
	}, slog.Default())
	if err != nil {
		_ = interviewClient.Close()
		pg.Close()
		return nil, err
	}

	var evalClient evaluator.Client
	if chain == nil {
		log.Info("no LLM API keys configured — using fake evaluator")
		evalClient = evaluator.NewFakeClient()
	} else {
		evalClient = evaluator.NewLLMJudge(chain, slog.Default())
	}

	repo := evaluationrepo.New(pg)
	svc := evaluationservice.New(evaluationservice.Deps{
		Repo:       repo,
		Interview:  interviewClient,
		Content:    contentClient,
		Evaluator:  evalClient,
		MaxRetries: cfg.EvalMaxRetries,
	})

	return &App{
		Config:          cfg,
		Logger:          log,
		Postgres:        pg,
		InterviewClient: interviewClient,
		ContentClient:   contentClient,
		interviewConn:   interviewClient,
		contentConn:     contentClient,
		Service:         svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.contentConn != nil {
		_ = a.contentConn.Close()
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
