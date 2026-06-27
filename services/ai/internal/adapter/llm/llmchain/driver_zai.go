package llmchain

import "context"

const ZAIEndpoint = "https://api.z.ai/api/paas/v4/chat/completions"

func NewZAIDriver(apiKey string) Driver {
	d := newOpenAIDriver(ProviderZAI, apiKey, ZAIEndpoint)
	d.supportsJSONMode = true
	d.supportsVision = false
	return &zaiDriver{openAIDriver: d}
}

type zaiDriver struct{ *openAIDriver }

func (z *zaiDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	return z.openAIDriver.Chat(ctx, model, req)
}

func (z *zaiDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	return z.openAIDriver.ChatStream(ctx, model, req)
}
