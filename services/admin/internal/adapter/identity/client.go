package identity

import (
	"context"
)

// UserStats is aggregate user registry metrics.
type UserStats struct {
	TotalUsers    int64
	NewUsers24h   int64
	NewUsers7d    int64
	NewUsers30d   int64
	ActiveUsers7d int64
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

// Client reads identity internal stats via gRPC.
type Client interface {
	Ping(ctx context.Context) error
	GetUserStats(ctx context.Context) (*UserStats, error)
	GetOpsStats(ctx context.Context) (*OpsStats, error)
}
