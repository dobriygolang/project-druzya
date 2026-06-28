package identityapi

import (
	"errors"
	"io"
	"net/http"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"

	"github.com/sedorofeevd/project-druzya/services/identity/internal/adapter/telegram"
	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
)

// UserAvatarHTTP serves profile photos (Telegram proxy or external URL redirect).
func (i *Implementation) UserAvatarHTTP() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		userID := r.PathValue("id")
		if userID == "" {
			writeHTTPError(w, invalidArgument("user id required"))
			return
		}

		user, err := i.service.GetUser(r.Context(), userID)
		if err != nil {
			writeHTTPError(w, mapServiceError(err))
			return
		}

		if path, ok := telegram.ParseStoreRef(user.AvatarURL); ok && path != "" {
			i.serveTelegramFile(w, r, path)
			return
		}

		if telegram.IsLegacyFakeURL(user.AvatarURL) && user.TelegramID != nil && i.telegramBotToken != "" {
			api, err := tgbotapi.NewBotAPI(i.telegramBotToken)
			if err == nil {
				if fresh, err := telegram.ProfilePhotoFilePath(api, *user.TelegramID); err == nil && fresh != "" {
					i.serveTelegramFile(w, r, fresh)
					return
				}
			}
		}

		if user.AvatarURL != "" && !telegram.IsLegacyFakeURL(user.AvatarURL) {
			http.Redirect(w, r, user.AvatarURL, http.StatusFound)
			return
		}

		writeHTTPError(w, notFound("avatar not found"))
	}
}

func (i *Implementation) serveTelegramFile(w http.ResponseWriter, r *http.Request, filePath string) {
	if i.telegramBotToken == "" {
		writeHTTPError(w, errors.New("telegram bot not configured"))
		return
	}
	body, contentType, err := telegram.OpenFile(r.Context(), i.telegramBotToken, filePath)
	if err != nil {
		if errors.Is(err, authservice.ErrNotFound) {
			writeHTTPError(w, notFound("avatar not found"))
			return
		}
		writeHTTPError(w, err)
		return
	}
	defer func() { _ = body.Close() }()

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, body)
}
