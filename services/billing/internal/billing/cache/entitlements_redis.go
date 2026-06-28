package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
)

const entitlementsKeyPrefix = "billing:entitlements:"

// EntitlementsRedis caches computed entitlement views per user.
type EntitlementsRedis struct {
	client *goredis.Client
	ttl    time.Duration
}

// NewEntitlementsRedis constructs a Redis-backed entitlements cache. client may be nil (disabled).
func NewEntitlementsRedis(client *goredis.Client, ttl time.Duration) *EntitlementsRedis {
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	return &EntitlementsRedis{client: client, ttl: ttl}
}

// Get returns a cached entitlements view when present.
func (c *EntitlementsRedis) Get(ctx context.Context, userID string) (*model.EntitlementsView, bool, error) {
	if c == nil || c.client == nil || userID == "" {
		return nil, false, nil
	}
	raw, err := c.client.Get(ctx, entitlementsKeyPrefix+userID).Bytes()
	if err != nil {
		if err == goredis.Nil {
			IncEntitlementsRedisMiss()
			return nil, false, nil
		}
		return nil, false, fmt.Errorf("redis get entitlements: %w", err)
	}
	var view model.EntitlementsView
	if err := json.Unmarshal(raw, &view); err != nil {
		return nil, false, fmt.Errorf("decode entitlements cache: %w", err)
	}
	IncEntitlementsRedisHit()
	return &view, true, nil
}

// Set stores an entitlements view.
func (c *EntitlementsRedis) Set(ctx context.Context, userID string, view *model.EntitlementsView) error {
	if c == nil || c.client == nil || userID == "" || view == nil {
		return nil
	}
	raw, err := json.Marshal(view)
	if err != nil {
		return fmt.Errorf("encode entitlements cache: %w", err)
	}
	if err := c.client.Set(ctx, entitlementsKeyPrefix+userID, raw, c.ttl).Err(); err != nil {
		return fmt.Errorf("redis set entitlements: %w", err)
	}
	return nil
}

// Invalidate removes a user's cached entitlements view.
func (c *EntitlementsRedis) Invalidate(ctx context.Context, userID string) {
	if c == nil || c.client == nil || userID == "" {
		return
	}
	_ = c.client.Del(ctx, entitlementsKeyPrefix+userID).Err()
}

// InvalidateAll drops all cached entitlement views (after plan limit changes).
func (c *EntitlementsRedis) InvalidateAll(ctx context.Context) error {
	if c == nil || c.client == nil {
		return nil
	}
	var cursor uint64
	for {
		keys, next, err := c.client.Scan(ctx, cursor, entitlementsKeyPrefix+"*", 100).Result()
		if err != nil {
			return fmt.Errorf("scan entitlements cache: %w", err)
		}
		if len(keys) > 0 {
			if err := c.client.Del(ctx, keys...).Err(); err != nil {
				return fmt.Errorf("delete entitlements cache: %w", err)
			}
		}
		cursor = next
		if cursor == 0 {
			break
		}
	}
	return nil
}
