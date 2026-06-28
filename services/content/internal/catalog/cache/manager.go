package cache

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"
)

// Manager holds the current catalog snapshot and reloads it from Postgres.
type Manager struct {
	ptr     atomic.Pointer[Snapshot]
	src     LoaderSource
	version atomic.Int64
	log     *slog.Logger
}

// NewManager constructs a catalog cache manager. src must not be nil.
func NewManager(src LoaderSource, log *slog.Logger) *Manager {
	return &Manager{src: src, log: log}
}

// Snapshot returns the current loaded snapshot or nil before the first reload.
func (m *Manager) Snapshot() *Snapshot {
	if m == nil {
		return nil
	}
	return m.ptr.Load()
}

// Version returns the monotonic snapshot generation counter.
func (m *Manager) Version() int64 {
	if m == nil {
		return 0
	}
	return m.version.Load()
}

// Reload rebuilds the snapshot from Postgres and swaps it atomically.
func (m *Manager) Reload(ctx context.Context) error {
	if m == nil || m.src == nil {
		return nil
	}
	start := time.Now()
	nextVersion := m.version.Load() + 1
	snap, err := Load(ctx, m.src, nextVersion)
	if err != nil {
		IncReload("error")
		return err
	}
	m.ptr.Store(snap)
	m.version.Store(nextVersion)
	ObserveReloadDuration(time.Since(start))
	SetSnapshotBytes(snap.EstimatedBytes())
	SetSnapshotVersion(nextVersion)
	IncReload("ok")
	if m.log != nil {
		m.log.InfoContext(ctx, "catalog cache reloaded",
			slog.Int64("version", nextVersion),
			slog.Int64("estimated_bytes", snap.EstimatedBytes()),
			slog.Int("tasks", len(snap.taskByID)),
			slog.Int("articles", len(snap.articles)),
		)
	}
	return nil
}
