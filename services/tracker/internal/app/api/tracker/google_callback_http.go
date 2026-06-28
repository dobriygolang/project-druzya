package trackerapi

import (
	"net/http"
)

// GoogleCallbackHTTP handles the Google OAuth redirect for Calendar integration.
func (i *Implementation) GoogleCallbackHTTP() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		state := r.URL.Query().Get("state")
		redirectURL, err := i.svc.HandleGoogleCallback(r.Context(), code, state)
		if err != nil {
			writeHTTPError(w, mapServiceError(err))
			return
		}
		http.Redirect(w, r, redirectURL, http.StatusFound)
	}
}
