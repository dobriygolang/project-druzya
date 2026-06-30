package app

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	billingadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing/grpc"
	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmcache"
	llmadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/config"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	llmconfigrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/repository"
	llmconfigservice "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/service"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
	goredis "github.com/redis/go-redis/v9"
)

// App holds adapters and the domain service.
type App struct {
	Config          *config.Config
	Logger          logger.Logger
	Postgres        *evaluationrepo.Pool
	Redis           *goredis.Client
	InterviewClient interviewadapter.Client
	ContentClient   contentadapter.Client
	BillingClient   billingadapter.Client
	billingConn     *billinggrpc.Client
	Repo            *evaluationrepo.Repository
	LLMConfigRepo   *llmconfigrepo.Repository
	LLMConfig       llmconfigservice.Service
	LLMChains       *llmchain.TierChains
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

	var billingClient billingadapter.Client
	var billingConn *billinggrpc.Client
	if cfg.BillingGRPCAddr != "" {
		billingConn, err = billinggrpc.NewClient(ctx, cfg.BillingGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			pg.Close()
			return nil, fmt.Errorf("init billing client: %w", err)
		}
		billingClient = billingConn
	}

	repo := evaluationrepo.New(pg)
	llmConfigRepo := llmconfigrepo.New(pg)
	freeChainOrder := coalesceEnv(cfg.LLMFreeChainOrder, cfg.LLMChainOrder)

	redisClient, err := llmcache.NewRedisClient(ctx, cfg.RedisAddr)
	if err != nil {
		if billingConn != nil {
			_ = billingConn.Close()
		}
		pg.Close()
		return nil, fmt.Errorf("init redis: %w", err)
	}

	chatClient, tierChains, err := llmadapter.BuildTierChains(llmadapter.BuildTierChainOpts{
		Config: llmadapter.TierBuildConfig{
			FreeChainOrder: freeChainOrder,
			PaidChainOrder: cfg.LLMPaidChainOrder,
			Caveman:        cfg.LLMCavemanLevel,
			Free: llmadapter.BuildConfig{
				Order:               freeChainOrder,
				Groq:                cfg.GroqAPIKey,
				Cerebras:            cfg.CerebrasAPIKey,
				Google:              cfg.GoogleAPIKey,
				Mistral:             cfg.MistralAPIKey,
				OpenRouter:          cfg.OpenRouterAPIKey,
				Cloudflare:          cfg.CloudflareAPIKey,
				CloudflareAccountID: cfg.CloudflareAccountID,
			},
			Paid: llmadapter.BuildConfig{
				Order:      cfg.LLMPaidChainOrder,
				Groq:       cfg.GroqPaidAPIKey,
				DeepSeek:   cfg.DeepSeekAPIKey,
				OpenRouter: cfg.OpenRouterPaidAPIKey,
			},
		},
		Log:                 slog.Default(),
		RuntimeConfigSource: llmConfigRepo,
		RuntimeCtx:          ctx,
		PromptCache: llmcache.Options{
			Enabled:    cfg.LLMPromptCacheEnabled,
			MaxEntries: cfg.LLMPromptCacheMaxEntries,
			TTL:        cfg.LLMPromptCacheTTL,
			Redis:      redisClient,
		},
	})
	if err != nil {
		if redisClient != nil {
			_ = redisClient.Close()
		}
		if billingConn != nil {
			_ = billingConn.Close()
		}
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
		Reloader: tierChains,
	})
	svc := evaluationservice.New(evaluationservice.Deps{
		Repo:       repo,
		Billing:    billingClient,
		Evaluator:  evalClient,
		MaxRetries: cfg.EvalMaxRetries,
	})

	return &App{
		Config:          cfg,
		Logger:          log,
		Postgres:        pg,
		Redis:           redisClient,
		BillingClient:   billingClient,
		billingConn:     billingConn,
		Repo:            repo,
		LLMConfigRepo:   llmConfigRepo,
		LLMConfig:       llmConfigSvc,
		LLMChains:       tierChains,
		Service:         svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.Redis != nil {
		_ = a.Redis.Close()
	}
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

func coalesceEnv(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
