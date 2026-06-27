package llmchain

import "context"

// DeepSeek (https://api.deepseek.com) — OpenAI-compatible chat-completions.
// Платный провайдер с лучшим price/reasoning на рынке (V3 = $0.27/$1.10
// input/output per 1M tokens, R1 = $0.55/$2.19). Оплата принимается
// UnionPay и международной криптой — доступен для РФ-юрлица без прокси.
//
// Модели, которые мы используем:
//   - "deepseek-chat"     — общая V3-модель (general purpose, streaming, JSON)
//   - "deepseek-reasoner" — R1, extended-thinking reasoning
//
// Используется ТОЛЬКО в paid-цепочках (druz9/pro, druz9/reasoning) —
// free-tier у DeepSeek нет. В default free task_map отсутствует.
const DeepSeekEndpoint = "https://api.deepseek.com/v1/chat/completions"

// NewDeepSeekDriver — drop-in по шаблону Groq/Cerebras. JSON mode работает,
// vision — нет (V3/R1 оба text-only). Streaming поддерживается.
func NewDeepSeekDriver(apiKey string) Driver {
	d := newOpenAIDriver(ProviderDeepSeek, apiKey, DeepSeekEndpoint)
	d.supportsJSONMode = true
	d.supportsVision = false
	return &deepseekDriver{openAIDriver: d}
}

type deepseekDriver struct{ *openAIDriver }

func (s *deepseekDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	return s.openAIDriver.Chat(ctx, model, req)
}

func (s *deepseekDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	return s.openAIDriver.ChatStream(ctx, model, req)
}
