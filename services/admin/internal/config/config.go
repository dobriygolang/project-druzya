package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/admin/internal/tools/ops"
)

// Config holds application configuration.
type Config struct {
	AppEnv             string
	LogLevel           string
	HTTPPort           int
	GRPCPort           int
	GRPCHost           string
	JWTPublicKeyPEM    []byte
	AdminUserIDs       map[string]struct{}
	ContentGRPCAddr    string
	ContentAdminToken  string
	IdentityGRPCAddr   string
	BillingGRPCAddr    string
	InternalAPIToken   string
	AIGRPCAddr         string
	CORSAllowedOrigins []string
}

// Load reads configuration from environment.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8088"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}
	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9098"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	publicKey, err := loadPEM("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt public key: %w", err)
	}

	adminToken := os.Getenv("CONTENT_ADMIN_TOKEN")
	if adminToken == "" {
		adminToken = os.Getenv("ADMIN_API_TOKEN")
	}
	if adminToken == "" {
		return nil, fmt.Errorf("CONTENT_ADMIN_TOKEN or ADMIN_API_TOKEN is required")
	}

	allowlist, err := parseAdminUserIDs(os.Getenv("ADMIN_USER_IDS"))
	if err != nil {
		return nil, err
	}
	if len(allowlist) == 0 {
		return nil, fmt.Errorf("ADMIN_USER_IDS is required (comma-separated UUIDs)")
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
		GRPCHost:           grpcListenHost(),
		JWTPublicKeyPEM:    publicKey,
		AdminUserIDs:       allowlist,
		ContentGRPCAddr:    getEnv("CONTENT_GRPC_ADDR", "127.0.0.1:9091"),
		ContentAdminToken:  adminToken,
		IdentityGRPCAddr:   getEnv("IDENTITY_GRPC_ADDR", "127.0.0.1:9090"),
		BillingGRPCAddr:    getEnv("BILLING_GRPC_ADDR", "127.0.0.1:9095"),
		InternalAPIToken:   internalToken,
		AIGRPCAddr:         getEnv("AI_GRPC_ADDR", "127.0.0.1:9093"),
		CORSAllowedOrigins: ops.ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
	}, nil
}

func parseAdminUserIDs(raw string) (map[string]struct{}, error) {
	out := make(map[string]struct{})
	for _, part := range strings.Split(raw, ",") {
		id := strings.TrimSpace(part)
		if id == "" {
			continue
		}
		out[id] = struct{}{}
	}
	return out, nil
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
