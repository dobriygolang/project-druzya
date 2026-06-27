// Package retryworker drives delayed retries of failed evaluation jobs and
// recovers jobs left in the running state after a crash. It complements the
// outbox worker, which only delivers fresh attempt_submitted events.
package retryworker

import (
	"context"
	"time"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
)

// Store reads jobs due for retry and recovers stuck running jobs.
type Store interface {
	ListRetryableAttemptIDs(ctx context.Context, now time.Time, limit int) ([]string, error)
	ResetStuckRunningJobs(ctx context.Context, olderThan time.Time) (int64, error)
}

// Runner re-runs evaluation for an attempt.
type Runner interface {
	RunEvaluation(ctx context.Context, attemptID string) error
}

// Config controls the retry worker cadence.
type Config struct {
	Interval     time.Duration
	BatchSize    int
	StuckTimeout time.Duration
}

func (c *Config) withDefaults() {
	if c.Interval <= 0 {
		c.Interval = 30 * time.Second
	}
	if c.BatchSize <= 0 {
		c.BatchSize = 10
	}
	if c.StuckTimeout <= 0 {
		c.StuckTimeout = 10 * time.Minute
	}
}

// Run polls for due retries and stuck jobs until ctx is cancelled.
func Run(ctx context.Context, log logger.Logger, store Store, runner Runner, cfg Config) error {
	cfg.withDefaults()
	ticker := time.NewTicker(cfg.Interval)
	defer ticker.Stop()

	log.Info("retry worker started", "interval", cfg.Interval.String())

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			sweep(ctx, log, store, runner, cfg)
		}
	}
}

func sweep(ctx context.Context, log logger.Logger, store Store, runner Runner, cfg Config) {
	if n, err := store.ResetStuckRunningJobs(ctx, time.Now().Add(-cfg.StuckTimeout)); err != nil {
		log.Error("reset stuck jobs failed", "err", err)
	} else if n > 0 {
		log.Info("recovered stuck jobs", "count", n)
	}

	ids, err := store.ListRetryableAttemptIDs(ctx, time.Now(), cfg.BatchSize)
	if err != nil {
		log.Error("list retryable jobs failed", "err", err)
		return
	}
	for _, attemptID := range ids {
		if err := runner.RunEvaluation(ctx, attemptID); err != nil {
			log.Error("retry evaluation failed", "attempt_id", attemptID, "err", err)
		}
	}
}
