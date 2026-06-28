package llmchain

import (
	"context"
	"strings"
	"time"
)

// ProviderProbeResult is a live health check of one chain link.
type ProviderProbeResult struct {
	Provider   Provider
	Model      string
	Registered bool
	OK         bool
	LatencyMs  int64
	Error      string
}

const probeTask = TaskSummarize

// ProbeChainProviders sends a minimal chat to each provider in the configured chain order.
func (c *Chain) ProbeChainProviders(ctx context.Context) []ProviderProbeResult {
	order := c.configuredOrder()
	taskMap := c.currentTaskMap()
	out := make([]ProviderProbeResult, 0, len(order))
	for _, provider := range order {
		result := ProviderProbeResult{Provider: provider}
		if _, ok := c.drivers[provider]; !ok {
			result.Error = "driver not registered (missing API key?)"
			out = append(out, result)
			continue
		}
		result.Registered = true
		model := strings.TrimSpace(taskMap.ModelFor(probeTask, provider))
		if model == "" {
			result.Error = "no model mapped for summarize probe"
			out = append(out, result)
			continue
		}
		result.Model = model
		start := c.clock()
		_, err := c.TestProviderModel(ctx, provider, model, "Reply with exactly: ok")
		result.LatencyMs = c.clock().Sub(start).Milliseconds()
		if err != nil {
			result.Error = err.Error()
			out = append(out, result)
			continue
		}
		result.OK = true
		out = append(out, result)
	}
	return out
}

func (c *Chain) configuredOrder() []Provider {
	if c.runtimeCfg != nil {
		if snap := c.runtimeCfg.snapshot(); snap != nil && len(snap.ChainOrder) > 0 {
			return append([]Provider(nil), snap.ChainOrder...)
		}
	}
	return append([]Provider(nil), c.order...)
}

// ProbeTimeout bounds operator-initiated provider probes.
const ProbeTimeout = 20 * time.Second
