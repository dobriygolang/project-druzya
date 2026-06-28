package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/tools/ops"
)

// Config holds application configuration loaded from environment.
type Config struct {
	AppEnv             string
	LogLevel           string
	HTTPPort           int
	GRPCPort           int
	GRPCHost           string
	PostgresDSN        string
	JWTPublicKeyPEM    []byte
	ContentGRPCAddr    string
	InterviewGRPCAddr  string
	BillingGRPCAddr    string
	InternalAPIToken   string
	RunnerMode         string
	MaxOutputBytes     int
	DefaultTimeoutMS   int
	DefaultMemoryMB    int
	DefaultCPUs        string
	MaxCodeBytes       int
	MaxStdinBytes      int
	MaxTests           int
	DockerGoImage      string
	DockerPythonImage  string
	DockerNodeImage    string
	CORSAllowedOrigins []string
	AsyncRuns          bool
	WorkerInterval     time.Duration
	WorkerBatchSize    int
}

// Load reads configuration from environment variables with sensible defaults.
func Load() (*Config, error) {
	httpPort, err := strconv.Atoi(getEnv("HTTP_PORT", "8086"))
	if err != nil {
		return nil, fmt.Errorf("invalid HTTP_PORT: %w", err)
	}

	grpcPort, err := strconv.Atoi(getEnv("GRPC_PORT", "9096"))
	if err != nil {
		return nil, fmt.Errorf("invalid GRPC_PORT: %w", err)
	}

	maxOutput, err := strconv.Atoi(getEnv("SANDBOX_MAX_OUTPUT_BYTES", "65536"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_MAX_OUTPUT_BYTES: %w", err)
	}

	timeoutMS, err := strconv.Atoi(getEnv("SANDBOX_DEFAULT_TIMEOUT_MS", "2000"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_DEFAULT_TIMEOUT_MS: %w", err)
	}

	memoryMB, err := strconv.Atoi(getEnv("SANDBOX_DEFAULT_MEMORY_MB", "128"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_DEFAULT_MEMORY_MB: %w", err)
	}

	workerIntervalMS, err := strconv.Atoi(getEnv("SANDBOX_WORKER_INTERVAL_MS", "500"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_WORKER_INTERVAL_MS: %w", err)
	}
	workerBatch, err := strconv.Atoi(getEnv("SANDBOX_WORKER_BATCH_SIZE", "10"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_WORKER_BATCH_SIZE: %w", err)
	}

	maxCodeBytes, err := strconv.Atoi(getEnv("SANDBOX_MAX_CODE_BYTES", "131072"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_MAX_CODE_BYTES: %w", err)
	}
	maxStdinBytes, err := strconv.Atoi(getEnv("SANDBOX_MAX_STDIN_BYTES", "65536"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_MAX_STDIN_BYTES: %w", err)
	}
	maxTests, err := strconv.Atoi(getEnv("SANDBOX_MAX_TESTS", "50"))
	if err != nil {
		return nil, fmt.Errorf("invalid SANDBOX_MAX_TESTS: %w", err)
	}

	appEnv := getEnv("APP_ENV", "development")
	runnerMode := getEnv("RUNNER_MODE", "fake")
	// Untrusted code must never run on the host in production: only the
	// container-isolated runner is allowed there.
	if appEnv == "production" && runnerMode != "docker" {
		return nil, fmt.Errorf("RUNNER_MODE must be 'docker' in production, got %q", runnerMode)
	}
	asyncRuns, err := parseAsyncRuns(getEnv("SANDBOX_ASYNC_RUNS", ""), runnerMode)
	if err != nil {
		return nil, err
	}

	publicKey, err := loadPEM("JWT_PUBLIC_KEY", "JWT_PUBLIC_KEY_FILE")
	if err != nil {
		return nil, fmt.Errorf("jwt public key: %w", err)
	}

	return &Config{
		AppEnv:             appEnv,
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		HTTPPort:           httpPort,
		GRPCPort:           grpcPort,
		GRPCHost:           grpcListenHost(),
		PostgresDSN:        getEnv("POSTGRES_DSN", "postgres://postgres:postgres@localhost:5439/druzya_sandbox?sslmode=disable"),
		JWTPublicKeyPEM:    publicKey,
		ContentGRPCAddr:    getEnv("CONTENT_GRPC_ADDR", "127.0.0.1:9091"),
		InterviewGRPCAddr:  getEnv("INTERVIEW_GRPC_ADDR", "127.0.0.1:9092"),
		BillingGRPCAddr:    getEnv("BILLING_GRPC_ADDR", ""),
		InternalAPIToken:   os.Getenv("INTERNAL_API_TOKEN"),
		RunnerMode:         runnerMode,
		MaxOutputBytes:     maxOutput,
		DefaultTimeoutMS:   timeoutMS,
		DefaultMemoryMB:    memoryMB,
		DefaultCPUs:        getEnv("SANDBOX_DEFAULT_CPUS", "1.0"),
		MaxCodeBytes:       maxCodeBytes,
		MaxStdinBytes:      maxStdinBytes,
		MaxTests:           maxTests,
		DockerGoImage:      getEnv("SANDBOX_DOCKER_GO_IMAGE", "golang:1.24-alpine"),
		DockerPythonImage:  getEnv("SANDBOX_DOCKER_PYTHON_IMAGE", "python:3.12-alpine"),
		DockerNodeImage:    getEnv("SANDBOX_DOCKER_NODE_IMAGE", "node:22-alpine"),
		CORSAllowedOrigins: ops.ParseOrigins(getEnv("CORS_ALLOWED_ORIGINS", "")),
		AsyncRuns:          asyncRuns,
		WorkerInterval:     time.Duration(workerIntervalMS) * time.Millisecond,
		WorkerBatchSize:    workerBatch,
	}, nil
}

func parseAsyncRuns(raw, runnerMode string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "auto":
		return runnerMode == "docker" || runnerMode == "process", nil
	case "1", "true", "yes", "on":
		return true, nil
	case "0", "false", "no", "off":
		return false, nil
	default:
		return false, fmt.Errorf("invalid SANDBOX_ASYNC_RUNS: %q", raw)
	}
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
