package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds application configuration loaded from environment.
type Config struct {
	AppEnv           string
	LogLevel         string
	HTTPPort         int
	GRPCPort         int
	PostgresDSN      string
	JWTPublicKeyPEM  []byte
	PublicBaseURL    string
	RoomTTL          time.Duration
	InviteSecret     []byte
	InviteTTL        time.Duration
	FreeMaxActive    int
	IdentityGRPCAddr string
	BillingGRPCAddr  string
	InternalAPIToken string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8087"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}

	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9097"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	roomTTL, err := time.ParseDuration(getEnv("ROOM_TTL", "6h"))
	if err != nil {
		return nil, fmt.Errorf("invalid ROOM_TTL: %w", err)
	}

	inviteTTL, err := time.ParseDuration(getEnv("ROOM_INVITE_TTL", "24h"))
	if err != nil {
		return nil, fmt.Errorf("invalid ROOM_INVITE_TTL: %w", err)
	}

	freeMax, err := strconv.Atoi(getEnv("ROOM_FREE_MAX_ACTIVE", "3"))
	if err != nil {
		return nil, fmt.Errorf("invalid ROOM_FREE_MAX_ACTIVE: %w", err)
	}

	publicKey, err := loadPEM("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt public key: %w", err)
	}

	inviteSecret := []byte(os.Getenv("ROOM_INVITE_SECRET"))
	if len(inviteSecret) == 0 {
		inviteSecret = []byte("dev-room-invite-secret")
	}

	return &Config{
		AppEnv:          getEnv("APP_ENV", "development"),
		LogLevel:        getEnv("LOG_LEVEL", "info"),
		HTTPPort:        httpPort,
		GRPCPort:        grpcPort,
		PostgresDSN:     getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5440/druzya_rooms?sslmode=disable"),
		JWTPublicKeyPEM: publicKey,
		PublicBaseURL:   getEnv("PUBLIC_BASE_URL", "http://localhost:5173"),
		RoomTTL:         roomTTL,
		InviteSecret:    inviteSecret,
		InviteTTL:       inviteTTL,
		FreeMaxActive:   freeMax,
		IdentityGRPCAddr: getEnv("IDENTITY_GRPC_ADDR", "127.0.0.1:9090"),
		BillingGRPCAddr:  getEnv("BILLING_GRPC_ADDR", ""),
		InternalAPIToken: os.Getenv("INTERNAL_API_TOKEN"),
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
	if v := os.Getenv(envKey); v != "" {
		return []byte(v), nil
	}
	return nil, fmt.Errorf("%s or %s is required", envKey, fileKey)
}
