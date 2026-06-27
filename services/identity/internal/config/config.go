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
	RedisAddr   string

	JWTPrivateKeyPEM []byte
	JWTPublicKeyPEM  []byte
	JWTAccessTTL     time.Duration
	JWTRefreshTTL    time.Duration

	TelegramBotToken    string
	TelegramBotUsername string

	YandexClientID     string
	YandexClientSecret string
	YandexRedirectURI  string

	FrontendURL string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}

	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9090"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	accessTTL, err := time.ParseDuration(getEnv("JWT_ACCESS_TTL", "15m"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_ACCESS_TTL: %w", err)
	}

	refreshTTL, err := time.ParseDuration(getEnv("JWT_REFRESH_TTL", "720h"))
	if err != nil {
		return nil, fmt.Errorf("invalid JWT_REFRESH_TTL: %w", err)
	}

	privateKey, err := loadPEM("JWT_PRIVATE_KEY", "JWT_PRIVATE_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt private key: %w", err)
	}

	publicKey, err := loadPEM("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt public key: %w", err)
	}

	return &Config{
		AppEnv:              getEnv("APP_ENV", "development"),
		LogLevel:            getEnv("LOG_LEVEL", "info"),
		HTTPPort:            httpPort,
		GRPCPort:            grpcPort,
		PostgresDSN:         getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5432/druzya?sslmode=disable"),
		RedisAddr:           getEnv("REDIS_ADDR", "localhost:6379"),
		JWTPrivateKeyPEM:    privateKey,
		JWTPublicKeyPEM:     publicKey,
		JWTAccessTTL:        accessTTL,
		JWTRefreshTTL:       refreshTTL,
		TelegramBotToken:    os.Getenv("TELEGRAM_BOT_TOKEN"),
		TelegramBotUsername: getEnv("TELEGRAM_BOT_USERNAME", ""),
		YandexClientID:      os.Getenv("YANDEX_CLIENT_ID"),
		YandexClientSecret:  os.Getenv("YANDEX_CLIENT_SECRET"),
		YandexRedirectURI:   os.Getenv("YANDEX_REDIRECT_URI"),
		FrontendURL:         getEnv("FRONTEND_URL", "http://localhost:3000"),
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
