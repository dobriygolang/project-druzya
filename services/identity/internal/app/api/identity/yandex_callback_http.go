package identityapi

import (
	"net/http"
)

// YandexCallbackHTTP handles browser redirect from Yandex OAuth.
func (i *Implementation) YandexCallbackHTTP() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		state := r.URL.Query().Get("state")
		if code == "" || state == "" {
			writeHTTPError(w, invalidArgument("code and state are required"))
			return
		}

		redirectURL, err := i.service.HandleYandexCallback(r.Context(), code, state)
		if err != nil {
			writeHTTPError(w, mapServiceError(err))
			return
		}

		http.Redirect(w, r, redirectURL, http.StatusFound)
	}
}

// PublicKeyHTTP exposes the JWT public key for other services.
func (i *Implementation) PublicKeyHTTP(publicKeyPEM []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/x-pem-file")
		_, _ = w.Write(publicKeyPEM)
	}
}
