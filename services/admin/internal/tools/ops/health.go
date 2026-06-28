package ops

import (
	"net/http"
	"strings"
)

// ParseOrigins splits a comma-separated CORS allowlist.
func ParseOrigins(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if v := strings.TrimSpace(p); v != "" {
			out = append(out, v)
		}
	}
	return out
}

// HealthzHandler returns liveness probe.
func HealthzHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}

// ReadyzHandler returns readiness when all checks pass.
func ReadyzHandler(checks ...func() error) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		for _, check := range checks {
			if err := check(); err != nil {
				http.Error(w, "not ready", http.StatusServiceUnavailable)
				return
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}

// CORS wraps h with permissive CORS for dev/admin UI.
func CORS(allowedOrigins []string, h http.Handler) http.Handler {
	if len(allowedOrigins) == 0 {
		return h
	}
	allowSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowSet[o] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if _, ok := allowSet[origin]; ok {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}
