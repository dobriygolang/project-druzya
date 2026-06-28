package app

import (
	"context"
	"fmt"
	"log/slog"

	billingadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing/grpc"
	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	contentgrpc "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content/grpc"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	interviewgrpc "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview/grpc"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	llmadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/config"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	llmconfigrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/repository"
	llmconfigservice "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/service"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
)

// App holds adapters and the domain service.
type App struct {
	Config          *config.Config
	Logger          logger.Logger
	Postgres        *evaluationrepo.Pool
	InterviewClient interviewadapter.Client
	ContentClient   contentadapter.Client
	BillingClient   billingadapter.Client
	interviewConn   *interviewgrpc.Client
	contentConn     *contentgrpc.Client
	billingConn     *billinggrpc.Client
	Repo            *evaluationrepo.Repository
	LLMConfigRepo   *llmconfigrepo.Repository
	LLMConfig       llmconfigservice.Service
	LLMChain        *llmchain.Chain
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

	var billingClient billingadapter.Client
	var billingConn *billinggrpc.Client
	if cfg.BillingGRPCAddr != "" {
		billingConn, err = billinggrpc.NewClient(ctx, cfg.BillingGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			_ = contentClient.Close()
			_ = interviewClient.Close()
			pg.Close()
			return nil, fmt.Errorf("init billing client: %w", err)
		}
		billingClient = billingConn
	}

	repo := evaluationrepo.New(pg)
	llmConfigRepo := llmconfigrepo.New(pg)

	chatClient, chain, err := llmadapter.BuildChain(llmadapter.BuildChainOpts{
		Config: llmadapter.BuildConfig{
			Order:               cfg.LLMChainOrder,
			OpenAI:              cfg.OpenAIAPIKey,
			Groq:                cfg.GroqAPIKey,
			Cerebras:            cfg.CerebrasAPIKey,
			Google:              cfg.GoogleAPIKey,
			Mistral:             cfg.MistralAPIKey,
			OpenRouter:          cfg.OpenRouterAPIKey,
			Cloudflare:          cfg.CloudflareAPIKey,
			CloudflareAccountID: cfg.CloudflareAccountID,
			Caveman:             cfg.LLMCavemanLevel,
		},
		Log:                 slog.Default(),
		RuntimeConfigSource: llmConfigRepo,
		RuntimeCtx:          ctx,
	})
	if err != nil {
		if billingConn != nil {
			_ = billingConn.Close()
		}
		_ = contentClient.Close()
		_ = interviewClient.Close()
		pg.Close()
		return nil, err
	}

	var evalClient evaluator.Client
	if chatClient == nil {
		log.Info("no LLM API keys configured — using fake evaluator")
		evalClient = evaluator.NewFakeClient()
	} else {
		evalClient = evaluator.NewLLMJudge(chatClient, slog.Default())
	}

	llmConfigSvc := llmconfigservice.New(llmconfigservice.Deps{
		Repo:     llmConfigRepo,
		Reloader: chain,
	})
	svc := evaluationservice.New(evaluationservice.Deps{
		Repo:       repo,
		Interview:  interviewClient,
		Content:    contentClient,
		Billing:    billingClient,
		Evaluator:  evalClient,
		MaxRetries: cfg.EvalMaxRetries,
	})

	return &App{
		Config:          cfg,
		Logger:          log,
		Postgres:        pg,
		InterviewClient: interviewClient,
		ContentClient:   contentClient,
		BillingClient:   billingClient,
		interviewConn:   interviewClient,
		contentConn:     contentClient,
		billingConn:     billingConn,
		Repo:            repo,
		LLMConfigRepo:   llmConfigRepo,
		LLMConfig:       llmConfigSvc,
		LLMChain:        chain,
		Service:         svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.billingConn != nil {
		_ = a.billingConn.Close()
	}
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
