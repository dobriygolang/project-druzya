package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds application configuration.
type Config struct {
	AppEnv      string
	LogLevel    string
	HTTPPort    int
	GRPCPort    int
	PostgresDSN string

	JWTPublicKeyPEM  []byte
	ContentGRPCAddr  string
	InternalAPIToken string
	SessionTTL       time.Duration
	TrainingLimit    int
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

	return &Config{
		AppEnv:           getEnv("APP_ENV", "development"),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		HTTPPort:         httpPort,
		GRPCPort:         grpcPort,
		PostgresDSN:      getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5434/druzya_interview?sslmode=disable"),
		JWTPublicKeyPEM:  publicKey,
		ContentGRPCAddr:  getEnv("CONTENT_GRPC_ADDR", "127.0.0.1:9091"),
		InternalAPIToken: internalToken,
		SessionTTL:       sessionTTL,
		TrainingLimit:    trainingLimit,
	}, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
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
