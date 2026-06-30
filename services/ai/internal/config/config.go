package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/ops"
)

// Config holds application configuration loaded from environment.
type Config struct {
	AppEnv      string
	LogLevel    string
	HTTPPort    int
	GRPCPort    int
	GRPCHost    string
	PostgresDSN string

	BillingGRPCAddr    string
	InternalAPIToken   string
	LLMChainOrder      string
	LLMFreeChainOrder  string
	LLMPaidChainOrder  string
	OpenAIAPIKey       string
	GroqAPIKey         string
	GroqPaidAPIKey     string
	CerebrasAPIKey    string
	GoogleAPIKey       string
	MistralAPIKey      string
	OpenRouterAPIKey   string
	OpenRouterPaidAPIKey string
	CloudflareAPIKey       string
	CloudflareAccountID    string
	DeepSeekAPIKey         string
	EvalMaxRetries         int
	EvalWorkerConcurrency  int
	WorkerPollInterval     time.Duration
	LLMCavemanLevel        string
	LLMPromptCacheEnabled  bool
	LLMPromptCacheMaxEntries int
	LLMPromptCacheTTL      time.Duration
	RedisAddr              string
	CORSAllowedOrigins     []string
	NATSURL                string
	OutboxPollEnabled      bool
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8083"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}

	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9093"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	evalMaxRetries, err := strconv.Atoi(getEnv("EVAL_MAX_RETRIES", "3"))
	if err != nil {
		return nil, fmt.Errorf("invalid EVAL_MAX_RETRIES: %w", err)
	}

	evalWorkerConcurrency, err := strconv.Atoi(getEnv("EVAL_WORKER_CONCURRENCY", "1"))
	if err != nil {
		return nil, fmt.Errorf("invalid EVAL_WORKER_CONCURRENCY: %w", err)
	}
	if evalWorkerConcurrency < 1 {
		return nil, fmt.Errorf("EVAL_WORKER_CONCURRENCY must be >= 1")
	}

	workerPoll, err := time.ParseDuration(getEnv("WORKER_POLL_INTERVAL", "2s"))
	if err != nil {
		return nil, fmt.Errorf("invalid WORKER_POLL_INTERVAL: %w", err)
	}

	promptCacheTTL, err := time.ParseDuration(getEnv("LLM_PROMPT_CACHE_TTL", "24h"))
	if err != nil {
		return nil, fmt.Errorf("invalid LLM_PROMPT_CACHE_TTL: %w", err)
	}

	promptCacheMax, err := strconv.Atoi(getEnv("LLM_PROMPT_CACHE_MAX_ENTRIES", "1000"))
	if err != nil {
		return nil, fmt.Errorf("invalid LLM_PROMPT_CACHE_MAX_ENTRIES: %w", err)
	}

	internalToken := os.Getenv("INTERNAL_API_TOKEN")
	if internalToken == "" {
		return nil, fmt.Errorf("INTERNAL_API_TOKEN is required")
	}

	appEnv := getEnv("APP_ENV", "development")
	if err := validateProduction(appEnv, internalToken, cfgKeys{
		Groq:       os.Getenv("GROQ_API_KEY"),
		Cerebras:   os.Getenv("CEREBRAS_API_KEY"),
		OpenAI:     os.Getenv("OPENAI_API_KEY"),
		Google:     os.Getenv("GOOGLE_API_KEY"),
		OpenRouter: os.Getenv("OPENROUTER_API_KEY"),
		Cloudflare: os.Getenv("CLOUDFLARE_API_KEY"),
	}); err != nil {
		return nil, err
	}

	return &Config{
		AppEnv:             appEnv,
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		HTTPPort:           httpPort,
		GRPCPort:           grpcPort,
		GRPCHost:           grpcListenHost(),
		PostgresDSN:        getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5435/druzya_ai?sslmode=disable"),
		BillingGRPCAddr:    os.Getenv("BILLING_GRPC_ADDR"),
		InternalAPIToken:   internalToken,
		LLMChainOrder:         getEnv("LLM_CHAIN_ORDER", "groq,cloudflare,openrouter"),
		LLMFreeChainOrder:     os.Getenv("LLM_FREE_CHAIN_ORDER"),
		LLMPaidChainOrder:     getEnv("LLM_PAID_CHAIN_ORDER", "deepseek,groq"),
		OpenAIAPIKey:          os.Getenv("OPENAI_API_KEY"),
		GroqAPIKey:            os.Getenv("GROQ_API_KEY"),
		GroqPaidAPIKey:        os.Getenv("GROQ_PAID_API_KEY"),
		CerebrasAPIKey:        os.Getenv("CEREBRAS_API_KEY"),
		GoogleAPIKey:          os.Getenv("GOOGLE_API_KEY"),
		MistralAPIKey:         os.Getenv("MISTRAL_API_KEY"),
		OpenRouterAPIKey:      os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterPaidAPIKey:  os.Getenv("OPENROUTER_PAID_API_KEY"),
		CloudflareAPIKey:      os.Getenv("CLOUDFLARE_API_KEY"),
		CloudflareAccountID:   os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
		DeepSeekAPIKey:        os.Getenv("DEEPSEEK_API_KEY"),
		EvalMaxRetries:      evalMaxRetries,
		EvalWorkerConcurrency: evalWorkerConcurrency,
		WorkerPollInterval:  workerPoll,
		LLMCavemanLevel:          getEnv("LLM_CAVEMAN", "lite"),
		LLMPromptCacheEnabled:    parseBoolEnv(getEnv("LLM_PROMPT_CACHE", "on")),
		LLMPromptCacheMaxEntries: promptCacheMax,
		LLMPromptCacheTTL:        promptCacheTTL,
		RedisAddr:                getEnv("REDIS_ADDR", ""),
		CORSAllowedOrigins:       ops.ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
		NATSURL:                  os.Getenv("NATS_URL"),
		OutboxPollEnabled:        outboxPollEnabled(os.Getenv("NATS_URL"), os.Getenv("OUTBOX_POLL_ENABLED")),
	}, nil
}

func parseBoolEnv(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "on", "yes":
		return true
	default:
		return false
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type cfgKeys struct {
	Groq, Cerebras, OpenAI, Google, OpenRouter, Cloudflare string
}

func hasLLMKey(keys cfgKeys) bool {
	return strings.TrimSpace(keys.Groq) != "" ||
		strings.TrimSpace(keys.Cerebras) != "" ||
		strings.TrimSpace(keys.OpenAI) != "" ||
		strings.TrimSpace(keys.Google) != "" ||
		strings.TrimSpace(keys.OpenRouter) != "" ||
		strings.TrimSpace(keys.Cloudflare) != ""
}

func validateProduction(appEnv, internalToken string, keys cfgKeys) error {
	if appEnv != "production" {
		return nil
	}
	if internalToken == "dev-internal-token" {
		return fmt.Errorf("INTERNAL_API_TOKEN must be changed in production")
	}
	if !hasLLMKey(keys) {
		return fmt.Errorf("at least one LLM API key is required in production")
	}
	return nil
}

func grpcListenHost() string {
	if v := os.Getenv("GRPC_HOST"); v != "" {
		return v
	}
	if getEnv("APP_ENV", "development") == "production" {
		return "0.0.0.0"
	}
	return "127.0.0.1"
}

func outboxPollEnabled(natsURL, flag string) bool {
	if strings.TrimSpace(natsURL) == "" {
		return parseBoolEnv(getEnv("OUTBOX_POLL_ENABLED", "true"))
	}
	switch strings.ToLower(strings.TrimSpace(flag)) {
	case "1", "true", "on", "yes":
		return true
	case "0", "false", "off", "no":
		return false
	default:
		return false
	}
}
