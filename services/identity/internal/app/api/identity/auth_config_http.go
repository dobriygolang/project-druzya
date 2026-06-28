package identityapi

import (
	"encoding/json"
	"net/http"
)

// AuthConfigHTTP exposes public auth settings for the SPA (no secrets).
func AuthConfigHTTP(telegramBotUsername string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"telegram_bot_username": telegramBotUsername,
		})
	}
}
