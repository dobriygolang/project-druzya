package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool wraps pgx connection pool.
type Pool struct {
	*pgxpool.Pool
}

// New creates a PostgreSQL connection pool.
func New(ctx context.Context, dsn string) (*Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Pool{Pool: pool}, nil
}
