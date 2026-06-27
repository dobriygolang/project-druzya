package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

const exchangeCodePrefix = "exchange_code:"

// ExchangeCodeRepository stores one-time Yandex exchange codes in Redis.
type ExchangeCodeRepository struct {
	client *Client
}

// NewExchangeCodeRepository constructs a Redis-backed exchange code repository.
func NewExchangeCodeRepository(client *Client) *ExchangeCodeRepository {
	return &ExchangeCodeRepository{client: client}
}

func (r *ExchangeCodeRepository) Save(ctx context.Context, code, userID string, ttlSeconds int) error {
	key := exchangeCodePrefix + code
	if err := r.client.Set(ctx, key, userID, time.Duration(ttlSeconds)*time.Second).Err(); err != nil {
		return fmt.Errorf("save exchange code: %w", err)
	}
	return nil
}

func (r *ExchangeCodeRepository) Consume(ctx context.Context, code string) (string, error) {
	key := exchangeCodePrefix + code
	userID, err := r.client.GetDel(ctx, key).Result()
	if err != nil {
		if errors.Is(err, goredis.Nil) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("get exchange code: %w", err)
	}
	return userID, nil
}
