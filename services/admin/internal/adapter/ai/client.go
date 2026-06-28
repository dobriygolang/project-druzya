package ai

import (
	"context"
	"errors"
	"time"
)

// ErrNotFound is returned when ai entity is missing.
var ErrNotFound = errors.New("not found")

// ErrVersionConflict marks optimistic lock failure on llm config.
var ErrVersionConflict = errors.New("llm config version conflict")

// EvaluationJobStatus mirrors ai job status.
type EvaluationJobStatus string

const (
	JobStatusPending   EvaluationJobStatus = "pending"
	JobStatusRunning   EvaluationJobStatus = "running"
	JobStatusCompleted EvaluationJobStatus = "completed"
	JobStatusFailed    EvaluationJobStatus = "failed"
)

// EvaluationJob is an async evaluation row.
type EvaluationJob struct {
	ID           string
	AttemptID    string
	UserID       string
	TaskID       string
	Status       EvaluationJobStatus
	RetryCount   int
	Retryable    bool
	Error        *string
	NextRetryAt  *time.Time
	StartedAt    *time.Time
	CompletedAt  *time.Time
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// LLMRuntimeConfig is operator-editable chain config.
type LLMRuntimeConfig struct {
	Version           int64
	ChainOrder        []string
	TaskMapJSON       string
	VirtualChainsJSON string
}

// UpdateLLMConfigInput writes llm runtime config.
type UpdateLLMConfigInput struct {
	ExpectedVersion   int64
	ChainOrder        []string
	TaskMapJSON       string
	VirtualChainsJSON string
}

// Client reads ai admin/internal APIs via gRPC.
type Client interface {
	Ping(ctx context.Context) error
	ListEvaluationJobs(ctx context.Context, status *EvaluationJobStatus, limit int) ([]EvaluationJob, error)
	GetEvaluationJob(ctx context.Context, id string) (*EvaluationJob, error)
	GetLLMConfig(ctx context.Context) (*LLMRuntimeConfig, error)
	UpdateLLMConfig(ctx context.Context, input UpdateLLMConfigInput) (*LLMRuntimeConfig, error)
	ProbeLLMProviders(ctx context.Context) ([]LLMProviderProbe, error)
	GetOpsStats(ctx context.Context) (*OpsStats, error)
}

// LLMProviderProbe is a live health check of one chain link.
type LLMProviderProbe struct {
	Provider   string
	Model      string
	Registered bool
	OK         bool
	LatencyMs  int64
	Error      string
}

// OpsStats is database footprint and process runtime metrics.
type OpsStats struct {
	ServiceName       string
	DatabaseName      string
	DatabaseSizeBytes int64
	MemoryAllocBytes  int64
	MemorySysBytes    int64
	Goroutines        int
	HTTPRPS           float64
}
