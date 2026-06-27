package llmchain

import "context"

// OpenRouter (https://openrouter.ai) — OpenAI-compatible aggregator.
// Kept in the chain as the tertiary (tail) provider for two reasons:
//
//  1. It speaks every premium model (Claude Sonnet, GPT-4o, Gemini Pro)
//     for BYOK / paid-tier users who picked a concrete OpenRouter id.
//
//  2. Its :free lane (qwen/qwen3-coder:free, openai/gpt-oss-120b:free)
//     is our last-resort fallback if Groq + Cerebras are both cold.
//
// Model IDs on OpenRouter always include a vendor prefix
// ("anthropic/claude-…", "qwen/qwen3-coder:free"). We pass them through
// unmodified — unlike Groq/Cerebras where we strip a "<provider>/" tag
// we added for internal routing.
const OpenRouterEndpoint = "https://openrouter.ai/api/v1/chat/completions"

// NewOpenRouterDriver constructs the OpenRouter driver.
func NewOpenRouterDriver(apiKey string) Driver {
	d := newOpenAIDriver(ProviderOpenRouter, apiKey, OpenRouterEndpoint)
	d.supportsJSONMode = true
	// Vision is available on OpenRouter via specific models (Claude 3.5,
	// GPT-4o). The base driver gates on this flag; callers who want
	// vision pass a ModelOverride pointing at a vision-capable OR id,
	// and this flag allows the request through.
	d.supportsVision = true
	return &openRouterDriver{openAIDriver: d}
}

type openRouterDriver struct{ *openAIDriver }

// OpenRouter model ids are always fully qualified ("vendor/model"), so
// we must NOT strip them — the shared helper is overridden here.
func (o *openRouterDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	// Bypass the provider-prefix strip by clearing ModelOverride on the
	// local copy only; content otherwise identical.
	reqCopy := req
	reqCopy.ModelOverride = ""
	return o.openAIDriver.Chat(ctx, model, reqCopy)
}

func (o *openRouterDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	reqCopy := req
	reqCopy.ModelOverride = ""
	return o.openAIDriver.ChatStream(ctx, model, reqCopy)
}
