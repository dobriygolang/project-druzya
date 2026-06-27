package llmchain

import "context"

// Cerebras Inference (https://cloud.cerebras.ai) — OpenAI-compatible
// chat-completions. Blazing-fast on LPU-class hardware (often 2-3×
// Groq on identical Llama variants).
//
// Known caveats:
//   - JSON mode is flaky on Cerebras free tier — response_format=
//     json_object is accepted but not always enforced. We leave it
//     enabled (harmless hint) and rely on prompt-level JSON discipline.
//   - Vision: text-only.
const CerebrasEndpoint = "https://api.cerebras.ai/v1/chat/completions"

// NewCerebrasDriver constructs the Cerebras driver. Empty apiKey ⇒ the
// wirer must skip registration (see the Groq driver note).
func NewCerebrasDriver(apiKey string) Driver {
	d := newOpenAIDriver(ProviderCerebras, apiKey, CerebrasEndpoint)
	d.supportsJSONMode = true
	d.supportsVision = false
	return &cerebrasDriver{openAIDriver: d}
}

type cerebrasDriver struct{ *openAIDriver }

func (c *cerebrasDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	return c.openAIDriver.Chat(ctx, model, req)
}

func (c *cerebrasDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	return c.openAIDriver.ChatStream(ctx, model, req)
}
