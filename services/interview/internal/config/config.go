package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/ops"
)

// Config holds application configuration.
type Config struct {
	AppEnv      string
	LogLevel    string
	HTTPPort    int
	GRPCPort    int
	GRPCHost    string
	PostgresDSN string

	JWTPublicKeyPEM  []byte
	ContentGRPCAddr         string
	RecommendationGRPCAddr  string
	InternalAPIToken string
	BillingGRPCAddr  string
	SessionTTL         time.Duration
	SessionStaleAfter  time.Duration
	SessionCleanupEvery time.Duration
	TrainingLimit    int
	CORSAllowedOrigins []string
	NATSURL              string
	OutboxRelayEnabled   bool
	AIGRPCAddr           string
}

// Load reads configuration from environment.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8082"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}
	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9092"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}
	sessionTTL, err := time.ParseDuration(getEnv("SESSION_TTL", "8h"))
	if err != nil {
		return nil, fmt.Errorf("invalid SESSION_TTL: %w", err)
	}
	sessionStaleAfter, err := time.ParseDuration(getEnv("SESSION_STALE_AFTER", "45m"))
	if err != nil {
		return nil, fmt.Errorf("invalid SESSION_STALE_AFTER: %w", err)
	}
	sessionCleanupEvery, err := time.ParseDuration(getEnv("SESSION_CLEANUP_INTERVAL", "5m"))
	if err != nil {
		return nil, fmt.Errorf("invalid SESSION_CLEANUP_INTERVAL: %w", err)
	}
	trainingLimit, err := strconv.Atoi(getEnv("TRAINING_TASK_LIMIT", "10"))
	if err != nil {
		return nil, fmt.Errorf("invalid TRAINING_TASK_LIMIT: %w", err)
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
		AppEnv:           getEnv("APP_ENV", "development"),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		HTTPPort:         httpPort,
		GRPCPort:         grpcPort,
		GRPCHost:         grpcListenHost(),
		PostgresDSN:      getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5434/druzya_interview?sslmode=disable"),
		JWTPublicKeyPEM:  publicKey,
		ContentGRPCAddr:        getEnv("CONTENT_GRPC_ADDR", "127.0.0.1:9091"),
		RecommendationGRPCAddr: getEnv("RECOMMENDATION_GRPC_ADDR", "127.0.0.1:9094"),
		InternalAPIToken:       internalToken,
		BillingGRPCAddr:  getEnv("BILLING_GRPC_ADDR", ""),
		SessionTTL:          sessionTTL,
		SessionStaleAfter:   sessionStaleAfter,
		SessionCleanupEvery: sessionCleanupEvery,
		TrainingLimit:       trainingLimit,
		CORSAllowedOrigins: ops.ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
		NATSURL:              os.Getenv("NATS_URL"),
		OutboxRelayEnabled:   outboxRelayEnabled(os.Getenv("NATS_URL"), os.Getenv("OUTBOX_RELAY_ENABLED")),
		AIGRPCAddr:           getEnv("AI_GRPC_ADDR", "127.0.0.1:9093"),
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

func outboxRelayEnabled(natsURL, flag string) bool {
	if strings.TrimSpace(natsURL) == "" {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(flag)) {
	case "0", "false", "off", "no":
		return false
	case "1", "true", "on", "yes":
		return true
	default:
		return true
	}
}
