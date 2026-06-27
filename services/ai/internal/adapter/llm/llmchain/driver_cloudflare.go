package llmchain

import (
	"context"
	"fmt"
)

func CloudflareEndpoint(accountID string) string {
	return fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/ai/v1/chat/completions", accountID)
}

func NewCloudflareDriver(apiKey, accountID string) Driver {
	if accountID == "" {
		return nil
	}
	d := newOpenAIDriver(ProviderCloudflare, apiKey, CloudflareEndpoint(accountID))
	d.supportsJSONMode = true
	d.supportsVision = false
	return &cloudflareDriver{openAIDriver: d}
}

type cloudflareDriver struct{ *openAIDriver }

func (c *cloudflareDriver) Chat(ctx context.Context, model string, req Request) (Response, error) {
	return c.openAIDriver.Chat(ctx, model, req)
}

func (c *cloudflareDriver) ChatStream(ctx context.Context, model string, req Request) (<-chan StreamEvent, error) {
	return c.openAIDriver.ChatStream(ctx, model, req)
}
