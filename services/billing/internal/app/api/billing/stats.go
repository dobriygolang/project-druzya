package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/ops"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GetPlatformStats returns billing platform aggregates (internal).
func (i *Implementation) GetPlatformStats(ctx context.Context, _ *billingv1.GetPlatformStatsRequest) (*billingv1.GetPlatformStatsResponse, error) {
	if i.repo == nil {
		return nil, status.Error(codes.Internal, "repository not configured")
	}
	count, err := i.repo.CountActiveSubscriptions(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &billingv1.GetPlatformStatsResponse{ActiveSubscriptions: count}, nil
}

// GetOpsStats returns database footprint and process runtime metrics (internal).
func (i *Implementation) GetOpsStats(ctx context.Context, _ *billingv1.GetOpsStatsRequest) (*billingv1.GetOpsStatsResponse, error) {
	if i.pg == nil {
		return nil, status.Error(codes.Internal, "postgres not configured")
	}
	db, err := ops.QueryDatabaseStats(ctx, i.pg.Pool)
	if err != nil {
		return nil, status.Error(codes.Internal, err.Error())
	}
	rt := ops.CollectRuntimeStats()
	return &billingv1.GetOpsStatsResponse{
		ServiceName:       "billing",
		DatabaseName:      db.Name,
		DatabaseSizeBytes: db.SizeBytes,
		MemoryAllocBytes:  int64(rt.MemoryAllocBytes),
		MemorySysBytes:    int64(rt.MemorySysBytes),
		Goroutines:        int32(rt.Goroutines),
		HttpRps:           rt.HTTPRPS,
	}, nil
}
