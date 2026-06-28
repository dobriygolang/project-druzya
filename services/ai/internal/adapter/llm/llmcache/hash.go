package llmcache

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
)

type hashPayload struct {
	Task          string          `json:"task"`
	ModelOverride string          `json:"model_override,omitempty"`
	UserTier      string          `json:"user_tier,omitempty"`
	Temperature   float64         `json:"temperature"`
	MaxTokens     int             `json:"max_tokens"`
	JSONMode      bool            `json:"json_mode"`
	Messages      []hashMessage   `json:"messages"`
}

type hashMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// HashRequest returns a stable SHA-256 hex key for exact prompt deduplication.
func HashRequest(req llmchain.Request) string {
	msgs := make([]hashMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		msgs = append(msgs, hashMessage{Role: string(m.Role), Content: m.Content})
	}
	payload := hashPayload{
		Task:          string(req.Task),
		ModelOverride: req.ModelOverride,
		UserTier:      string(req.UserTier),
		Temperature:   req.Temperature,
		MaxTokens:     req.MaxTokens,
		JSONMode:      req.JSONMode,
		Messages:      msgs,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return hex.EncodeToString(sha256.New().Sum(nil))
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
