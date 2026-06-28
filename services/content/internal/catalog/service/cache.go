package service

import (
	"context"
	"log/slog"

	catalogcache "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/cache"
)

func (s *catalogService) reloadCache(ctx context.Context) {
	if s.cache == nil {
		return
	}
	if err := s.cache.Reload(ctx); err != nil {
		slog.WarnContext(ctx, "catalog cache reload failed", slog.Any("err", err))
	}
}

func (s *catalogService) snapshot() *catalogcache.Snapshot {
	if s.cache == nil {
		return nil
	}
	return s.cache.Snapshot()
}

func (s *catalogService) cacheBypass() {
	catalogcache.IncMiss()
}

func (s *catalogService) cacheHit() {
	catalogcache.IncHit()
}
