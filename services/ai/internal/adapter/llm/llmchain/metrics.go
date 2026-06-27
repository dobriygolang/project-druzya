package llmchain

import (
	"time"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/ops"
)

func observeCall(p Provider, _ string, result string, dur time.Duration) {
	ops.IncLLMCall(string(p), result)
	ops.ObserveLLMCallDuration(string(p), dur)
}

func incFallback(p Provider, _ string) {
	ops.IncLLMCall(string(p), "fallback")
}

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
