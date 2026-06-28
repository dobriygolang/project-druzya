package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/ops"
)

// Config holds application configuration loaded from environment.
type Config struct {
	AppEnv      string
	LogLevel    string
	HTTPPort    int
	GRPCPort    int
	GRPCHost    string
	PostgresDSN string

	JWTPublicKeyPEM    []byte
	InterviewGRPCAddr  string
	ContentGRPCAddr    string
	InternalAPIToken   string
	WorkerPollInterval time.Duration
	CORSAllowedOrigins []string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8084"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}

	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9094"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	workerPoll, err := time.ParseDuration(getEnv("WORKER_POLL_INTERVAL", "2s"))
	if err != nil {
		return nil, fmt.Errorf("invalid WORKER_POLL_INTERVAL: %w", err)
	}

	publicKey, err := loadPEM("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt public key: %w", err)
	}

	internalToken := os.Getenv("INTERNAL_API_TOKEN")
	if internalToken == "" {
		return nil, fmt.Errorf("INTERNAL_API_TOKEN is required")
	}
	if err := validateProduction(getEnv("APP_ENV", "development"), internalToken); err != nil {
		return nil, err
	}

	return &Config{
		AppEnv:             getEnv("APP_ENV", "development"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		HTTPPort:           httpPort,
		GRPCPort:           grpcPort,
		GRPCHost:           grpcListenHost(),
		PostgresDSN:        getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5436/druzya_recommendation?sslmode=disable"),
		JWTPublicKeyPEM:    publicKey,
		InterviewGRPCAddr:  getEnv("INTERVIEW_GRPC_ADDR", "127.0.0.1:9092"),
		ContentGRPCAddr:    getEnv("CONTENT_GRPC_ADDR", "127.0.0.1:9091"),
		InternalAPIToken:   internalToken,
		WorkerPollInterval: workerPoll,
		CORSAllowedOrigins: ops.ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
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

func validateProduction(appEnv, internalToken string) error {
	if appEnv != "production" {
		return nil
	}
	if internalToken == "dev-internal-token" {
		return fmt.Errorf("INTERNAL_API_TOKEN must be changed in production")
	}
	return nil
}

func loadPEM(envKey, fileKey string) ([]byte, error) {
	if path := os.Getenv(fileKey); path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", fileKey, err)
		}
		return data, nil
	}
	value := os.Getenv(envKey)
	if value == "" {
		return nil, fmt.Errorf("%s or %s is required", envKey, fileKey)
	}
	return []byte(value), nil
}
