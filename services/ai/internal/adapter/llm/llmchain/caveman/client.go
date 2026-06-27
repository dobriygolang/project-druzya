package caveman

import (
	"context"
	"log/slog"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

// Client wraps a ChatClient and compresses outgoing message text (caveman-lite/full).
// Deterministic — no extra LLM hop. JSON schemas and ``` code blocks preserved.
type Client struct {
	inner llmchain.ChatClient
	level Level
	log   *slog.Logger
}

// New wraps inner when level != off.
func New(inner llmchain.ChatClient, level Level, log *slog.Logger) llmchain.ChatClient {
	if inner == nil || level == LevelOff {
		return inner
	}
	if log == nil {
		log = slog.Default()
	}
	return &Client{inner: inner, level: level, log: log}
}

func (c *Client) Chat(ctx context.Context, req llmchain.Request) (llmchain.Response, error) {
	compressed, stats := c.compressRequest(req)
	if stats.Saved() > 0 {
		c.log.Debug("llm caveman compress",
			"level", c.level,
			"chars_before", stats.CharsBefore,
			"chars_after", stats.CharsAfter,
			"saved", stats.Saved(),
			"saved_pct", stats.SavedPct(),
		)
	}
	return c.inner.Chat(ctx, compressed)
}

func (c *Client) ChatStream(ctx context.Context, req llmchain.Request) (<-chan llmchain.StreamEvent, error) {
	compressed, stats := c.compressRequest(req)
	if stats.Saved() > 0 {
		c.log.Debug("llm caveman compress",
			"level", c.level,
			"chars_before", stats.CharsBefore,
			"chars_after", stats.CharsAfter,
			"saved", stats.Saved(),
		)
	}
	return c.inner.ChatStream(ctx, compressed)
}

func (c *Client) compressRequest(req llmchain.Request) (llmchain.Request, Stats) {
	if len(req.Messages) == 0 {
		return req, Stats{Level: c.level}
	}

	out := req
	out.Messages = make([]llmchain.Message, len(req.Messages))
	var before, after int

	for i, msg := range req.Messages {
		before += len(msg.Content)
		compressed, _ := CompressText(c.level, msg.Content)
		after += len(compressed)
		out.Messages[i] = llmchain.Message{
			Role:    msg.Role,
			Content: compressed,
			Images:  msg.Images,
		}
	}

	return out, Stats{Level: c.level, CharsBefore: before, CharsAfter: after}
}
