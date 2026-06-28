package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	"github.com/sedorofeevd/project-druzya/services/content/internal/tools/ops"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GetOpsStats returns database footprint and process runtime metrics (admin).
func (i *Implementation) GetOpsStats(ctx context.Context, _ *contentv1.GetOpsStatsRequest) (*contentv1.GetOpsStatsResponse, error) {
	if i.pg == nil {
		return nil, status.Error(codes.Internal, "postgres not configured")
	}
	db, err := ops.QueryDatabaseStats(ctx, i.pg.Pool)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	rt := ops.CollectRuntimeStats()
	return &contentv1.GetOpsStatsResponse{
		ServiceName:       "content",
		DatabaseName:      db.Name,
		DatabaseSizeBytes: db.SizeBytes,
		MemoryAllocBytes:  int64(rt.MemoryAllocBytes),
		MemorySysBytes:    int64(rt.MemorySysBytes),
		Goroutines:        int32(rt.Goroutines),
		HttpRps:           rt.HTTPRPS,
	}, nil
}
