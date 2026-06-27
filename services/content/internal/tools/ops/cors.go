package ops

import (
	"net/http"
	"strings"
)

// CORS wraps h with Access-Control headers for allowed browser origins.
func CORS(origins []string, h http.Handler) http.Handler {
	if len(origins) == 0 {
		return h
	}
	allowed := make(map[string]struct{}, len(origins))
	for _, o := range origins {
		allowed[o] = struct{}{}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			if _, ok := allowed[origin]; ok {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			}
		}
		if r.Method == http.MethodOptions {
			if origin != "" {
				if _, ok := allowed[origin]; ok {
					w.WriteHeader(http.StatusNoContent)
					return
				}
			}
			http.NotFound(w, r)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// AuthRateLimit applies a simple per-IP limit to auth endpoints.
func AuthRateLimit(maxPerMinute int, h http.Handler) http.Handler {
	if maxPerMinute <= 0 {
		return h
	}
	limiter := newIPLimiter(maxPerMinute)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/v1/auth") {
			if !limiter.allow(clientIP(r)) {
				http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
				return
			}
		}
		h.ServeHTTP(w, r)
	})
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	if xri := r.Header.Get("X-Real-Ip"); xri != "" {
		return strings.TrimSpace(xri)
	}
	host := r.RemoteAddr
	if i := strings.LastIndexByte(host, ':'); i >= 0 {
		return host[:i]
	}
	return host
}
