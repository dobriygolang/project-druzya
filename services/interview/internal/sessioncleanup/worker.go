package sessioncleanup

import (
	"context"
	"time"

	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/logger"
)

type Cleaner interface {
	ExpireStaleActiveSessions(ctx context.Context) (int64, error)
}

// Run periodically expires idle or over-TTL active interview sessions.
func Run(ctx context.Context, log logger.Logger, svc Cleaner, every time.Duration) {
	if every <= 0 {
		every = 5 * time.Minute
	}
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	runOnce := func() {
		n, err := svc.ExpireStaleActiveSessions(ctx)
		if err != nil {
			log.Error("session cleanup failed", "err", err)
			return
		}
		if n > 0 {
			log.Info("expired stale interview sessions", "count", n)
		}
	}

	runOnce()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runOnce()
		}
	}
}
