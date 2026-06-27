package ops

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"
)

const readyTimeout = 2 * time.Second

// Checker verifies a dependency for readiness probes.
type Checker func(ctx context.Context) error

// HealthzHandler returns 200 when the process is alive.
func HealthzHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}

// ReadyzHandler returns 200 only when all checkers succeed.
func ReadyzHandler(checkers ...Checker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), readyTimeout)
		defer cancel()

		for _, check := range checkers {
			if check == nil {
				continue
			}
			if err := check(ctx); err != nil {
				http.Error(w, "not ready", http.StatusServiceUnavailable)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}

// PingPostgres checks PostgreSQL connectivity.
func PingPostgres(pool *pgxpool.Pool) Checker {
	return func(ctx context.Context) error {
		if pool == nil {
			return context.Canceled
		}
		return pool.Ping(ctx)
	}
}

// PingRedis checks Redis connectivity.
func PingRedis(client *goredis.Client) Checker {
	return func(ctx context.Context) error {
		if client == nil {
			return context.Canceled
		}
		return client.Ping(ctx).Err()
	}
}

// ParseOrigins splits a comma-separated CORS allowlist.
func ParseOrigins(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
