package llmchain

import "time"

// Metrics are no-op in ai-service until Prometheus wiring is added.

func observeCall(_ Provider, _, _ string, _ time.Duration) {}

func incFallback(_ Provider, _ string) {}

func observeCostWithUser(p Provider, task, model, userID string, tokensIn, tokensOut, latencyMs int) {
	emitInvocation(InvocationEvent{
		Provider:     string(p),
		Model:        model,
		TaskKind:     task,
		UserID:       userID,
		InputTokens:  tokensIn,
		OutputTokens: tokensOut,
		CostCents:    EstimateCostCents(model, tokensIn, tokensOut),
		LatencyMs:    latencyMs,
	})
}

func observeUnknownModel(_ string) {}
