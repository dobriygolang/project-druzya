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

	InterviewGRPCAddr  string
	ContentGRPCAddr    string
	BillingGRPCAddr    string
	InternalAPIToken   string
	LLMChainOrder      string
	OpenAIAPIKey       string
	GroqAPIKey         string
	CerebrasAPIKey     string
	GoogleAPIKey       string
	EvalMaxRetries     int
	WorkerPollInterval time.Duration
	LLMCavemanLevel    string
	CORSAllowedOrigins []string
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

	workerPoll, err := time.ParseDuration(getEnv("WORKER_POLL_INTERVAL", "2s"))
	if err != nil {
		return nil, fmt.Errorf("invalid WORKER_POLL_INTERVAL: %w", err)
	}

	internalToken := os.Getenv("INTERNAL_API_TOKEN")
	if internalToken == "" {
		return nil, fmt.Errorf("INTERNAL_API_TOKEN is required")
	}

	appEnv := getEnv("APP_ENV", "development")
	if err := validateProduction(appEnv, internalToken, cfgKeys{
		Groq:     os.Getenv("GROQ_API_KEY"),
		Cerebras: os.Getenv("CEREBRAS_API_KEY"),
		OpenAI:   os.Getenv("OPENAI_API_KEY"),
		Google:   os.Getenv("GOOGLE_API_KEY"),
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
		InterviewGRPCAddr:  getEnv("INTERVIEW_GRPC_ADDR", "127.0.0.1:9092"),
		ContentGRPCAddr:    getEnv("CONTENT_GRPC_ADDR", "127.0.0.1:9091"),
		BillingGRPCAddr:    os.Getenv("BILLING_GRPC_ADDR"),
		InternalAPIToken:   internalToken,
		LLMChainOrder:      getEnv("LLM_CHAIN_ORDER", "groq,cerebras,openai,google"),
		OpenAIAPIKey:       os.Getenv("OPENAI_API_KEY"),
		GroqAPIKey:         os.Getenv("GROQ_API_KEY"),
		CerebrasAPIKey:     os.Getenv("CEREBRAS_API_KEY"),
		GoogleAPIKey:       os.Getenv("GOOGLE_API_KEY"),
		EvalMaxRetries:     evalMaxRetries,
		WorkerPollInterval: workerPoll,
		LLMCavemanLevel:    getEnv("LLM_CAVEMAN", "lite"),
		CORSAllowedOrigins: ops.ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type cfgKeys struct {
	Groq, Cerebras, OpenAI, Google string
}

func hasLLMKey(keys cfgKeys) bool {
	return strings.TrimSpace(keys.Groq) != "" ||
		strings.TrimSpace(keys.Cerebras) != "" ||
		strings.TrimSpace(keys.OpenAI) != "" ||
		strings.TrimSpace(keys.Google) != ""
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
