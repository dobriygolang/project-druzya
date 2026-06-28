package cache

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	plansSnapshotBytes = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "billing_plans_snapshot_bytes",
		Help: "Estimated in-memory billing plans snapshot size",
	})
	plansHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "billing_plans_cache_hits_total",
		Help: "Billing plan catalog reads served from memory",
	})
	plansMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "billing_plans_cache_misses_total",
		Help: "Billing plan catalog reads with no warmed snapshot",
	})
	plansReloadTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "billing_plans_reload_total",
		Help: "Billing plans snapshot reload attempts",
	}, []string{"result"})
	plansReloadDuration = promauto.NewHistogram(prometheus.HistogramOpts{
		Name:    "billing_plans_reload_duration_seconds",
		Help:    "Billing plans snapshot reload latency",
		Buckets: prometheus.DefBuckets,
	})
	entitlementsRedisHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "billing_entitlements_redis_hits_total",
		Help: "GetEntitlements responses served from Redis",
	})
	entitlementsRedisMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "billing_entitlements_redis_misses_total",
		Help: "GetEntitlements responses loaded from Postgres",
	})
)

func IncPlansHit() { plansHits.Inc() }
func IncPlansMiss() { plansMisses.Inc() }
func IncPlansReload(result string) { plansReloadTotal.WithLabelValues(result).Inc() }
func ObservePlansReloadDuration(d time.Duration) { plansReloadDuration.Observe(d.Seconds()) }
func SetPlansSnapshotBytes(n int64) { plansSnapshotBytes.Set(float64(n)) }
func IncEntitlementsRedisHit() { entitlementsRedisHits.Inc() }
func IncEntitlementsRedisMiss() { entitlementsRedisMisses.Inc() }
