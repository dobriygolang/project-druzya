package ops

import (
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "http_requests_total",
		Help: "Total HTTP requests",
	}, []string{"service", "route", "method", "status"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "http_request_duration_seconds",
		Help:    "HTTP request latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"service", "route", "method"})

	httpRequestSamples = atomic.Uint64{}
	httpRPSMilli       = atomic.Uint64{}
)

func init() {
	go trackHTTPRPS()
}

func trackHTTPRPS() {
	var prev uint64
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		cur := httpRequestSamples.Load()
		rps := float64(cur-prev) / 5.0
		httpRPSMilli.Store(uint64(rps * 1000))
		prev = cur
	}
}

// HTTPRPS returns a smoothed HTTP requests-per-second estimate.
func HTTPRPS() float64 {
	return float64(httpRPSMilli.Load()) / 1000.0
}

// MetricsHandler exposes Prometheus metrics.
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}

// InstrumentHTTP wraps h with request counters and latency histograms.
func InstrumentHTTP(service string, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		h.ServeHTTP(rw, r)
		route := routeLabel(r.URL.Path)
		status := strconv.Itoa(rw.status)
		httpRequestsTotal.WithLabelValues(service, route, r.Method, status).Inc()
		httpRequestSamples.Add(1)
		httpRequestDuration.WithLabelValues(service, route, r.Method).Observe(time.Since(start).Seconds())
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func routeLabel(path string) string {
	path = strings.Trim(path, "/")
	if path == "" {
		return "/"
	}
	parts := strings.Split(path, "/")
	switch {
	case len(parts) >= 2:
		return "/" + parts[0] + "/" + parts[1]
	default:
		return "/" + parts[0]
	}
}
