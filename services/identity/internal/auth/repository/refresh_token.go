package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

const refreshTokenPrefix = "refresh:"

// RefreshTokenRepository stores refresh token hashes in Redis.
type RefreshTokenRepository struct {
	client *Client
}

// NewRefreshTokenRepository constructs a Redis-backed refresh token repository.
func NewRefreshTokenRepository(client *Client) *RefreshTokenRepository {
	return &RefreshTokenRepository{client: client}
}

func (r *RefreshTokenRepository) Save(ctx context.Context, tokenHash, userID string, ttlSeconds int) error {
	key := refreshTokenPrefix + tokenHash
	if err := r.client.Set(ctx, key, userID, time.Duration(ttlSeconds)*time.Second).Err(); err != nil {
		return fmt.Errorf("save refresh token: %w", err)
	}
	return nil
}

func (r *RefreshTokenRepository) GetUserID(ctx context.Context, tokenHash string) (string, error) {
	key := refreshTokenPrefix + tokenHash
	userID, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("get refresh token: %w", err)
	}
	return userID, nil
}

func (r *RefreshTokenRepository) Delete(ctx context.Context, tokenHash string) error {
	key := refreshTokenPrefix + tokenHash
	if err := r.client.Del(ctx, key).Err(); err != nil {
		return fmt.Errorf("delete refresh token: %w", err)
	}
	return nil
}
