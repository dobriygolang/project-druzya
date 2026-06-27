package llmchain

const OpenAIEndpoint = "https://api.openai.com/v1/chat/completions"

// NewOpenAIProviderDriver registers OpenAI API direct access.
func NewOpenAIProviderDriver(apiKey string) Driver {
	return newOpenAIDriver(Provider("openai"), apiKey, OpenAIEndpoint)
}
