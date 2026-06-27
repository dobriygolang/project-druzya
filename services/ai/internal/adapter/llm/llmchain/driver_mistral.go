package llmchain

import "context"

// Mistral La Plateforme (https://console.mistral.ai) — OpenAI-compatible
// endpoint at /v1/chat/completions. Free experimental tier gives Mistral
// Small / Codestral with modest quotas.
//
// Caveats:
//   - The free tier has documented rate limits but doesn't emit
//     x-ratelimit-* headers — proactive cooling is disabled for Mistral
//     (see ratelimit.go, parseRateLimitHeaders branch). Reactive 429
//     handling only.
//   - Vision: text-only for the free lane. Pixtral on paid — not in our
//     default chain.
const MistralEndpoint = "https://api.mistral.ai/v1/chat/completions"

// NewMistralDriver constructs the Mistral driver.
func NewMistralDriver(apiKey string) Driver {
	d := newOpenAIDriver(ProviderMistral, apiKey, MistralEndpoint)
	d.supportsJSONMode = true
	d.supportsVision = false
	return &mistralDriver{openAIDriver: d}
}

type mistralDriver struct{ *openAIDriver }

func (m *mistralDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	return m.openAIDriver.Chat(ctx, model, req)
}

func (m *mistralDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	return m.openAIDriver.ChatStream(ctx, model, req)
}
