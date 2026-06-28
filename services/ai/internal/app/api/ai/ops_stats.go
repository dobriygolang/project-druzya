package aiapi

import (
	"context"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/ops"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GetOpsStats returns database footprint and process runtime metrics (internal).
func (i *Implementation) GetOpsStats(ctx context.Context, _ *aiv1.GetOpsStatsRequest) (*aiv1.GetOpsStatsResponse, error) {
	if i.pg == nil {
		return nil, status.Error(codes.Internal, "postgres not configured")
	}
	db, err := ops.QueryDatabaseStats(ctx, i.pg.Pool)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	rt := ops.CollectRuntimeStats()
	return &aiv1.GetOpsStatsResponse{
		ServiceName:       "ai",
		DatabaseName:      db.Name,
		DatabaseSizeBytes: db.SizeBytes,
		MemoryAllocBytes:  int64(rt.MemoryAllocBytes),
		MemorySysBytes:    int64(rt.MemorySysBytes),
		Goroutines:        int32(rt.Goroutines),
		HttpRps:           rt.HTTPRPS,
	}, nil
}
