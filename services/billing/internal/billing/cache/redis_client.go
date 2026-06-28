package cache

import (
	"context"
	"fmt"

	goredis "github.com/redis/go-redis/v9"
)

// NewRedisClient dials Redis when addr is non-empty.
func NewRedisClient(ctx context.Context, addr string) (*goredis.Client, error) {
	if addr == "" {
		return nil, nil
	}
	client := goredis.NewClient(&goredis.Options{Addr: addr})
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("redis ping: %w", err)
	}
	return client, nil
}
