package llm

import "context"

// EvaluateRequest is input for LLM evaluation.
type EvaluateRequest struct {
	SystemPrompt string
	UserPrompt   string
	JSONSchema   string
}

// EvaluateResponse is raw LLM output plus usage metadata.
type EvaluateResponse struct {
	Provider         string
	Model            string
	Content          string
	RequestJSON      []byte
	ResponseJSON     []byte
	PromptTokens     *int
	CompletionTokens *int
	TotalTokens      *int
	CostUSD          *float64
	LatencyMS        int
}

// Client evaluates candidate answers via LLM.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	Evaluate(ctx context.Context, req EvaluateRequest) (EvaluateResponse, error)
}
