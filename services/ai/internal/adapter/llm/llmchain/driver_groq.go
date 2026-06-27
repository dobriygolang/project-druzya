package llmchain

import "context"

// Groq (https://console.groq.com) — OpenAI-compatible chat-completions.
// Free tier limits on launch day: 30 RPM / 14.4k RPD per model, plenty
// for our mixed workload.
//
// Vision: с релизом Llama 4 (early 2025) у Groq появились multimodal
// модели — `meta-llama/llama-4-scout-17b-16e-instruct` и `llama-4-maverick`
// принимают image_url content-blocks по OpenAI-spec. supportsVision=true
// чтобы chain мог гнать через Groq image-запросы. Если в task_map
// для конкретной задачи указана НЕ vision-модель Groq — driver вернёт
// ErrModelNotSupported и chain пойдёт дальше (ровно для этого
// hasImages-guard в driver_openai.go и есть).
// JSON mode: Groq supports response_format:"json_object" on all models.
const GroqEndpoint = "https://api.groq.com/openai/v1/chat/completions"

// NewGroqDriver constructs the Groq driver. apiKey is required — pass
// the value from config.LLMChain.GroqAPIKey. The chain's wirer MUST
// skip registration when the key is empty (a driver with an empty key
// will only ever return 401, wasting one chain hop per request).
func NewGroqDriver(apiKey string) Driver {
	d := newOpenAIDriver(ProviderGroq, apiKey, GroqEndpoint)
	d.supportsJSONMode = true
	// Vision-capable: Llama 4 Scout / Maverick через Groq принимают
	// image_url content-blocks. Если task_map для конкретной задачи
	// указывает text-only Groq-модель (llama-3.3-70b и т.д.) — driver
	// вернёт ErrModelNotSupported только если в request'е ЕСТЬ images
	// (см. driver_openai.go::Chat/ChatStream hasImages-guard). Для
	// текстовых запросов всё работает как раньше.
	d.supportsVision = true
	return &groqDriver{openAIDriver: d}
}

type groqDriver struct{ *openAIDriver }

// Chat / ChatStream inherit from openAIDriver. We override only if the
// provider deviates; Groq doesn't today.
func (g *groqDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	return g.openAIDriver.Chat(ctx, model, req)
}

func (g *groqDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	return g.openAIDriver.ChatStream(ctx, model, req)
}
