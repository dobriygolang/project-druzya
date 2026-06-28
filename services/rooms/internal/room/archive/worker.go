package archive

import (
	"context"
	"time"

	roomrepo "github.com/sedorofeevd/project-druzya/services/rooms/internal/room/repository"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/tools/logger"
)

// Run periodically archives rooms whose expires_at has passed.
func Run(ctx context.Context, repo *roomrepo.Repository, interval time.Duration, log logger.Logger) {
	if interval <= 0 {
		interval = time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			n, err := repo.ArchiveExpired(ctx)
			if err != nil {
				log.Error("archive expired rooms", "err", err)
				continue
			}
			if n > 0 {
				log.Info("archived expired rooms", "count", n)
			}
		}
	}
}
