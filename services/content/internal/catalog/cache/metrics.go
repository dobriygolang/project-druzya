package cache

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	snapshotBytes = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "content_catalog_snapshot_bytes",
		Help: "Estimated in-memory catalog snapshot size",
	})
	snapshotVersion = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "content_catalog_snapshot_version",
		Help: "Monotonic catalog snapshot generation",
	})
	cacheHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "content_catalog_cache_hits_total",
		Help: "Catalog reads served from in-memory snapshot",
	})
	cacheMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "content_catalog_cache_misses_total",
		Help: "Catalog reads that bypassed the snapshot",
	})
	reloadTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "content_catalog_reload_total",
		Help: "Catalog snapshot reload attempts",
	}, []string{"result"})
	reloadDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "content_catalog_reload_duration_seconds",
		Help:    "Catalog snapshot reload latency",
		Buckets: prometheus.DefBuckets,
	})
)

// IncHit records a cache hit.
func IncHit() { cacheHits.Inc() }

// IncMiss records a cache miss or bypass.
func IncMiss() { cacheMisses.Inc() }

// IncReload records reload result.
func IncReload(result string) { reloadTotal.WithLabelValues(result).Inc() }

// ObserveReloadDuration records reload latency.
func ObserveReloadDuration(d time.Duration) { reloadDuration.Observe(d.Seconds()) }

// SetSnapshotBytes updates snapshot size gauge.
func SetSnapshotBytes(n int64) { snapshotBytes.Set(float64(n)) }

// SetSnapshotVersion updates snapshot version gauge.
func SetSnapshotVersion(v int64) { snapshotVersion.Set(float64(v)) }
