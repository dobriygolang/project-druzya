package telegram

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
)

const FilePrefix = "telegram:"

// ProfilePhotoFilePath returns Telegram file_path for the user's profile photo.
func ProfilePhotoFilePath(bot *tgbotapi.BotAPI, userID int64) (string, error) {
	if bot == nil || userID == 0 {
		return "", nil
	}
	photos, err := bot.GetUserProfilePhotos(tgbotapi.UserProfilePhotosConfig{
		UserID: userID,
		Limit:  1,
	})
	if err != nil {
		return "", fmt.Errorf("get user profile photos: %w", err)
	}
	if photos.TotalCount == 0 || len(photos.Photos) == 0 {
		return "", nil
	}
	sizes := photos.Photos[0]
	if len(sizes) == 0 {
		return "", nil
	}
	largest := sizes[len(sizes)-1]
	file, err := bot.GetFile(tgbotapi.FileConfig{FileID: largest.FileID})
	if err != nil {
		return "", fmt.Errorf("get telegram file: %w", err)
	}
	if file.FilePath == "" {
		return "", nil
	}
	return file.FilePath, nil
}

// StoreRef encodes a Telegram file_path for DB storage.
func StoreRef(filePath string) string {
	if filePath == "" {
		return ""
	}
	return FilePrefix + filePath
}

// ParseStoreRef returns file_path from stored avatar reference.
func ParseStoreRef(stored string) (string, bool) {
	return strings.CutPrefix(stored, FilePrefix)
}

// IsLegacyFakeURL reports synthetic t.me userpic URLs that always 404.
func IsLegacyFakeURL(url string) bool {
	return strings.Contains(url, "t.me/i/userpic/")
}

// OpenFile downloads a Telegram file by file_path using the bot token.
func OpenFile(ctx context.Context, botToken, filePath string) (io.ReadCloser, string, error) {
	if botToken == "" || filePath == "" {
		return nil, "", fmt.Errorf("telegram file download not configured")
	}
	url := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", botToken, filePath)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	if resp.StatusCode != http.StatusOK {
		_ = resp.Body.Close()
		return nil, "", fmt.Errorf("telegram file download: status %d", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}
	return resp.Body, ct, nil
}
