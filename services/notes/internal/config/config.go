package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	AppEnv           string
	LogLevel         string
	HTTPPort         int
	GRPCPort         int
	GRPCHost         string
	PostgresDSN      string
	JWTPublicKeyPEM  []byte
	PublicBaseURL    string
	BillingGRPCAddr  string
	InternalAPIToken string
}

func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8090"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}
	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9100"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}
	publicKey, err := loadPEM("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt public key: %w", err)
	}
	return &Config{
		AppEnv:           getEnv("APP_ENV", "development"),
		LogLevel:         getEnv("LOG_LEVEL", "info"),
		HTTPPort:         httpPort,
		GRPCPort:         grpcPort,
		GRPCHost:         grpcListenHost(),
		PostgresDSN:      getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5442/druzya_notes?sslmode=disable"),
		JWTPublicKeyPEM:  publicKey,
		PublicBaseURL:    getEnv("PUBLIC_BASE_URL", getEnv("FRONTEND_URL", "http://localhost:5173")),
		BillingGRPCAddr:  getEnv("BILLING_GRPC_ADDR", "127.0.0.1:9095"),
		InternalAPIToken: getEnv("INTERNAL_API_TOKEN", ""),
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
