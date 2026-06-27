package billingapi

import (
	"io"
	"net/http"
	"strings"

	billingservice "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/service"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/humanerror"
)

// TributeWebhookHandler handles Tribute provider webhooks.
func TributeWebhookHandler(svc billingservice.Service) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		headers := map[string]string{}
		for k, vals := range r.Header {
			if len(vals) > 0 {
				headers[k] = vals[0]
			}
		}
		if err := svc.HandleProviderWebhook(r.Context(), "tribute", headers, body); err != nil {
			if strings.Contains(err.Error(), "invalid tribute webhook secret") {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			humanerror.WriteHTTP(w, mapServiceError(err))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	}
}
