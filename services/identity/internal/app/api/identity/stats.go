package identityapi

import (
	"context"

	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/tools/ops"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// GetUserStats returns aggregate user registry metrics (internal).
func (i *Implementation) GetUserStats(ctx context.Context, _ *identityv1.GetUserStatsRequest) (*identityv1.GetUserStatsResponse, error) {
	if i.users == nil {
		return nil, status.Error(codes.Internal, "user repository not configured")
	}
	stats, err := i.users.GetUserStats(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &identityv1.GetUserStatsResponse{
		TotalUsers:    stats.TotalUsers,
		NewUsers_24H:  stats.NewUsers24h,
		NewUsers_7D:   stats.NewUsers7d,
		NewUsers_30D:  stats.NewUsers30d,
		ActiveUsers_7D: stats.ActiveUsers7d,
	}, nil
}

// GetOpsStats returns database footprint and process runtime metrics (internal).
func (i *Implementation) GetOpsStats(ctx context.Context, _ *identityv1.GetOpsStatsRequest) (*identityv1.GetOpsStatsResponse, error) {
	if i.pg == nil {
		return nil, status.Error(codes.Internal, "postgres not configured")
	}
	db, err := ops.QueryDatabaseStats(ctx, i.pg.Pool)
	if err != nil {
		return nil, mapServiceError(err)
	}
	rt := ops.CollectRuntimeStats()
	return &identityv1.GetOpsStatsResponse{
		ServiceName:       "identity",
		DatabaseName:      db.Name,
		DatabaseSizeBytes: db.SizeBytes,
		MemoryAllocBytes:  int64(rt.MemoryAllocBytes),
		MemorySysBytes:    int64(rt.MemorySysBytes),
		Goroutines:        int32(rt.Goroutines),
		HttpRps:           rt.HTTPRPS,
	}, nil
}
