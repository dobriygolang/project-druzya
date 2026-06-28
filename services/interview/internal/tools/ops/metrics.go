package ops

import (
	"net/http"
	"strconv"
	"strings"
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
)

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

// IncOutboxEvent records outbox worker results.
func IncOutboxEvent(service, event, result string) {
	outboxEventsTotal.WithLabelValues(service, event, result).Inc()
}

// ObserveOutboxDuration records outbox handler latency.
func ObserveOutboxDuration(service, event string, d time.Duration) {
	outboxDuration.WithLabelValues(service, event).Observe(d.Seconds())
}

var (
	outboxEventsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "outbox_events_total",
		Help: "Outbox events processed",
	}, []string{"service", "event", "result"})

	outboxDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "outbox_handler_duration_seconds",
		Help:    "Outbox handler latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"service", "event"})

	outboxRelayPublishTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "outbox_relay_publish_total",
		Help: "Outbox relay publish attempts",
	}, []string{"event", "result"})

	outboxLagSeconds = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "outbox_lag_seconds",
		Help:    "Time from outbox created_at to handler start",
		Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60, 120},
	}, []string{"service", "event"})
)

// IncRelayPublish records relay publish results.
func IncRelayPublish(event, result string) {
	outboxRelayPublishTotal.WithLabelValues(event, result).Inc()
}

// ObserveOutboxLag records queue wait time before handling.
func ObserveOutboxLag(service, event string, d time.Duration) {
	outboxLagSeconds.WithLabelValues(service, event).Observe(d.Seconds())
}

// IncLLMCall records LLM invocation results.
func IncLLMCall(provider, result string) {
	llmCallsTotal.WithLabelValues(provider, result).Inc()
}

// ObserveLLMCallDuration records LLM call latency.
func ObserveLLMCallDuration(provider string, d time.Duration) {
	llmCallDuration.WithLabelValues(provider).Observe(d.Seconds())
}

var (
	llmCallsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "llm_calls_total",
		Help: "LLM API calls",
	}, []string{"provider", "result"})

	llmCallDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "llm_call_duration_seconds",
		Help:    "LLM call latency",
		Buckets: prometheus.DefBuckets,
	}, []string{"provider"})
)
