package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/ops"
)

// Config holds application configuration loaded from environment.
type Config struct {
	AppEnv             string
	LogLevel           string
	HTTPPort           int
	GRPCPort           int
	GRPCHost           string
	PostgresDSN        string
	InternalAPIToken   string
	JWTPublicKeyPEM    []byte
	IdentityGRPCAddr   string
	TributeWebhookSecret string
	TributeTierToPlan  map[string]string
	CORSAllowedOrigins []string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8085"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}

	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9095"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	internalToken := os.Getenv("INTERNAL_API_TOKEN")
	if internalToken == "" {
		return nil, fmt.Errorf("INTERNAL_API_TOKEN is required")
	}
	tributeSecret := getEnv("TRIBUTE_WEBHOOK_SECRET", "")
	if err := validateProduction(getEnv("APP_ENV", "development"), internalToken); err != nil {
		return nil, err
	}

	publicKey, err := loadPEM("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt public key: %w", err)
	}

	return &Config{
		AppEnv:               getEnv("APP_ENV", "development"),
		LogLevel:             getEnv("LOG_LEVEL", "info"),
		HTTPPort:             httpPort,
		GRPCPort:             grpcPort,
		GRPCHost:             grpcListenHost(),
		PostgresDSN:          getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5438/druzya_billing?sslmode=disable"),
		InternalAPIToken:     internalToken,
		JWTPublicKeyPEM:      publicKey,
		IdentityGRPCAddr:     getEnv("IDENTITY_GRPC_ADDR", "127.0.0.1:9090"),
		TributeWebhookSecret: tributeSecret,
		TributeTierToPlan:    parseTierMap(getEnv("TRIBUTE_TIER_MAP", "tribute_pro_monthly:pro_monthly")),
		CORSAllowedOrigins:   ops.ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
	}, nil
}

func parseTierMap(raw string) map[string]string {
	out := map[string]string{}
	for part := range strings.SplitSeq(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		k, v, ok := strings.Cut(part, ":")
		if !ok {
			continue
		}
		k = strings.ToLower(strings.TrimSpace(k))
		v = strings.TrimSpace(v)
		if k != "" && v != "" {
			out[k] = v
		}
	}
	return out
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

func validateProduction(appEnv, internalToken string) error {
	if appEnv != "production" {
		return nil
	}
	if internalToken == "dev-internal-token" {
		return fmt.Errorf("INTERNAL_API_TOKEN must be changed in production")
	}
	return nil
}
