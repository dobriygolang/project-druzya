package ops

import "net/http"

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
