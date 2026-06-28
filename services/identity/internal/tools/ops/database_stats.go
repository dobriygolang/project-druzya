package ops

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DatabaseStats is PostgreSQL footprint for the current database.
type DatabaseStats struct {
	Name      string
	SizeBytes int64
}

// QueryDatabaseStats reads database name and on-disk size.
func QueryDatabaseStats(ctx context.Context, pool *pgxpool.Pool) (DatabaseStats, error) {
	if pool == nil {
		return DatabaseStats{}, fmt.Errorf("postgres pool not configured")
	}
	var out DatabaseStats
	err := pool.QueryRow(ctx, `
		SELECT current_database(), pg_database_size(current_database())
	`).Scan(&out.Name, &out.SizeBytes)
	return out, err
}
