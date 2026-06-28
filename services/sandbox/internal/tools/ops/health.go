package ops

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const readyTimeout = 5 * time.Second

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
		for _, check := range checkers {
			if check == nil {
				continue
			}
			ctx, cancel := context.WithTimeout(r.Context(), readyTimeout)
			err := check(ctx)
			cancel()
			if err != nil {
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
