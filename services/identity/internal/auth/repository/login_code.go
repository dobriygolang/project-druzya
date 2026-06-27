package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/auth/model"
)

const loginCodePrefix = "login_code:"

type loginCodePayload struct {
	TelegramID int64     `json:"telegram_id"`
	FirstName  string    `json:"first_name"`
	LastName   string    `json:"last_name"`
	Username   string    `json:"username"`
	AvatarURL  string    `json:"avatar_url"`
	ExpiresAt  time.Time `json:"expires_at"`
}

// LoginCodeRepository stores Telegram login codes in Redis.
type LoginCodeRepository struct {
	client *Client
}

// NewLoginCodeRepository constructs a Redis-backed login code repository.
func NewLoginCodeRepository(client *Client) *LoginCodeRepository {
	return &LoginCodeRepository{client: client}
}

func (r *LoginCodeRepository) Save(ctx context.Context, code string, data *model.TelegramLoginCode, ttlSeconds int) error {
	payload, err := json.Marshal(loginCodePayload{
		TelegramID: data.TelegramID,
		FirstName:  data.FirstName,
		LastName:   data.LastName,
		Username:   data.Username,
		AvatarURL:  data.AvatarURL,
		ExpiresAt:  data.ExpiresAt,
	})
	if err != nil {
		return fmt.Errorf("marshal login code: %w", err)
	}

	key := loginCodePrefix + code
	if err := r.client.Set(ctx, key, payload, time.Duration(ttlSeconds)*time.Second).Err(); err != nil {
		return fmt.Errorf("save login code: %w", err)
	}
	return nil
}

func (r *LoginCodeRepository) Consume(ctx context.Context, code string) (*model.TelegramLoginCode, error) {
	key := loginCodePrefix + code
	raw, err := r.client.GetDel(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get login code: %w", err)
	}

	var payload loginCodePayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("unmarshal login code: %w", err)
	}
	if time.Now().UTC().After(payload.ExpiresAt) {
		return nil, ErrNotFound
	}

	return &model.TelegramLoginCode{
		TelegramID: payload.TelegramID,
		FirstName:  payload.FirstName,
		LastName:   payload.LastName,
		Username:   payload.Username,
		AvatarURL:  payload.AvatarURL,
		ExpiresAt:  payload.ExpiresAt,
	}, nil
}
