package llmcache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

const redisKeyPrefix = "ai:llm:prompt:"

type redisStore struct {
	client *goredis.Client
	ttl    time.Duration
}

func newRedisStore(client *goredis.Client, ttl time.Duration) *redisStore {
	if client == nil {
		return nil
	}
	if ttl <= 0 {
		ttl = 24 * time.Hour
	}
	return &redisStore{client: client, ttl: ttl}
}

func (s *redisStore) get(ctx context.Context, key string) (llmchain.Response, bool, error) {
	if s == nil || s.client == nil {
		return llmchain.Response{}, false, nil
	}
	raw, err := s.client.Get(ctx, redisKeyPrefix+key).Bytes()
	if err != nil {
		if err == goredis.Nil {
			return llmchain.Response{}, false, nil
		}
		return llmchain.Response{}, false, fmt.Errorf("redis get llm cache: %w", err)
	}
	var resp llmchain.Response
	if err := json.Unmarshal(raw, &resp); err != nil {
		return llmchain.Response{}, false, fmt.Errorf("decode llm cache: %w", err)
	}
	return resp, true, nil
}

func (s *redisStore) set(ctx context.Context, key string, resp llmchain.Response) error {
	if s == nil || s.client == nil {
		return nil
	}
	raw, err := json.Marshal(resp)
	if err != nil {
		return fmt.Errorf("encode llm cache: %w", err)
	}
	if err := s.client.Set(ctx, redisKeyPrefix+key, raw, s.ttl).Err(); err != nil {
		return fmt.Errorf("redis set llm cache: %w", err)
	}
	return nil
}
