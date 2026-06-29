package model

import "time"

// User represents a platform account linked to Telegram and/or Yandex.
type User struct {
	ID         string
	Username   string
	TelegramID *int64
	YandexID   *string
	AvatarURL  string
	Timezone   string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}
