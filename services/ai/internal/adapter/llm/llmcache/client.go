package llmcache

import (
	"context"
	"log/slog"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

// Options configures exact prompt hash caching for non-streaming Chat calls.
type Options struct {
	Enabled    bool
	MaxEntries int
	TTL        time.Duration
	Redis      *goredis.Client
	Log        *slog.Logger
}

// Client wraps a ChatClient with in-memory LRU and optional Redis L2 cache.
type Client struct {
	inner llmchain.ChatClient
	mem   *memoryStore
	redis *redisStore
	log   *slog.Logger
}

// NewClient wraps inner when Enabled; otherwise returns inner unchanged.
func NewClient(inner llmchain.ChatClient, opts Options) llmchain.ChatClient {
	if inner == nil || !opts.Enabled {
		return inner
	}
	return &Client{
		inner: inner,
		mem:   newMemoryStore(opts.MaxEntries, opts.TTL),
		redis: newRedisStore(opts.Redis, opts.TTL),
		log:   opts.Log,
	}
}

// Chat returns a cached response on exact prompt hash match.
func (c *Client) Chat(ctx context.Context, req llmchain.Request) (llmchain.Response, error) {
	key := HashRequest(req)

	if resp, ok := c.mem.get(key); ok {
		resp.FromCache = true
		IncHit(resp.TokensIn, resp.TokensOut)
		return resp, nil
	}

	if c.redis != nil {
		resp, ok, err := c.redis.get(ctx, key)
		if err != nil {
			if c.log != nil {
				c.log.WarnContext(ctx, "llm prompt cache redis get failed", slog.Any("err", err))
			}
		} else if ok {
			c.mem.set(key, resp)
			resp.FromCache = true
			IncHit(resp.TokensIn, resp.TokensOut)
			return resp, nil
		}
	}

	IncMiss()
	resp, err := c.inner.Chat(ctx, req)
	if err != nil {
		return resp, err
	}

	c.mem.set(key, resp)
	if c.redis != nil {
		if err := c.redis.set(ctx, key, resp); err != nil && c.log != nil {
			c.log.WarnContext(ctx, "llm prompt cache redis set failed", slog.Any("err", err))
		}
	}
	return resp, nil
}

// ChatStream bypasses the cache — streaming responses are not snapshot-safe.
func (c *Client) ChatStream(ctx context.Context, req llmchain.Request) (<-chan llmchain.StreamEvent, error) {
	return c.inner.ChatStream(ctx, req)
}
