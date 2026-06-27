package llmchain

import "context"

const GoogleEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

func NewGoogleDriver(apiKey string) Driver {
	d := newOpenAIDriver(ProviderGoogle, apiKey, GoogleEndpoint)
	d.supportsJSONMode = true
	d.supportsVision = true
	return &googleDriver{openAIDriver: d}
}

type googleDriver struct{ *openAIDriver }

func (g *googleDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	return g.openAIDriver.Chat(ctx, model, req)
}

func (g *googleDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	return g.openAIDriver.ChatStream(ctx, model, req)
}
