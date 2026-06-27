package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds application configuration loaded from environment.
type Config struct {
	AppEnv      string
	LogLevel    string
	HTTPPort    int
	GRPCPort    int
	PostgresDSN string

	InterviewGRPCAddr  string
	ContentGRPCAddr    string
	InternalAPIToken   string
	LLMChainOrder      string
	OpenAIAPIKey       string
	GroqAPIKey         string
	CerebrasAPIKey     string
	GoogleAPIKey       string
	EvalMaxRetries     int
	WorkerPollInterval time.Duration
	LLMCavemanLevel    string
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

	return &Config{
		AppEnv:             getEnv("APP_ENV", "development"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		HTTPPort:           httpPort,
		GRPCPort:           grpcPort,
		PostgresDSN:        getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5435/druzya_ai?sslmode=disable"),
		InterviewGRPCAddr:  getEnv("INTERVIEW_GRPC_ADDR", "127.0.0.1:9092"),
		ContentGRPCAddr:    getEnv("CONTENT_GRPC_ADDR", "127.0.0.1:9091"),
		InternalAPIToken:   internalToken,
		LLMChainOrder:      getEnv("LLM_CHAIN_ORDER", "groq,cerebras,openai,google"),
		OpenAIAPIKey:       os.Getenv("OPENAI_API_KEY"),
		GroqAPIKey:         os.Getenv("GROQ_API_KEY"),
		CerebrasAPIKey:     os.Getenv("CEREBRAS_API_KEY"),
		GoogleAPIKey:       os.Getenv("GOOGLE_API_KEY"),
		EvalMaxRetries:     evalMaxRetries,
		WorkerPollInterval: workerPoll,
		LLMCavemanLevel:    getEnv("LLM_CAVEMAN", "lite"),
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
