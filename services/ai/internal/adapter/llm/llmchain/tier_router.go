package llmchain

import (
	"context"
	"log/slog"
)

var _ ChatClient = (*TierRouter)(nil)

// TierRouter routes Chat requests to free or pro provider chains based on
// req.UserTier. Pro users fall back to the free chain when no paid chain
// was wired at startup.
type TierRouter struct {
	free   ChatClient
	pro    ChatClient
	chains *TierChains
	log    *slog.Logger
}

// TierChains holds concrete chains for admin probes and runtime config.
type TierChains struct {
	Free *Chain
	Pro  *Chain
}

// NewTierRouter wires tier-aware routing. pro may be nil — then pro tier
// uses free. chains is used for admin probes (may be nil).
func NewTierRouter(free, pro ChatClient, chains *TierChains, log *slog.Logger) *TierRouter {
	if pro == nil {
		pro = free
	}
	if chains == nil {
		chains = &TierChains{}
	}
	if chains.Pro == nil {
		chains.Pro = chains.Free
	}
	if log == nil {
		log = slog.Default()
	}
	return &TierRouter{free: free, pro: pro, chains: chains, log: log}
}

// Chains returns registered chains for ops/admin.
func (r *TierRouter) Chains() *TierChains {
	return r.chains
}

// Chat implements ChatClient.
func (r *TierRouter) Chat(ctx context.Context, req Request) (Response, error) {
	if TierCovers(req.UserTier, SubscriptionPlanPro) {
		return r.pro.Chat(ctx, req)
	}
	return r.free.Chat(ctx, req)
}

// ChatStream implements ChatClient.
func (r *TierRouter) ChatStream(ctx context.Context, req Request) (<-chan StreamEvent, error) {
	if TierCovers(req.UserTier, SubscriptionPlanPro) {
		return r.pro.ChatStream(ctx, req)
	}
	return r.free.ChatStream(ctx, req)
}

// ProbeAll runs health probes on free and pro chains (when distinct).
func (tc *TierChains) ProbeAll(ctx context.Context) []ProviderProbeResult {
	if tc == nil || tc.Free == nil {
		return nil
	}
	out := prefixProbeResults("free", tc.Free.ProbeChainProviders(ctx))
	if tc.Pro != nil && tc.Pro != tc.Free {
		out = append(out, prefixProbeResults("pro", tc.Pro.ProbeChainProviders(ctx))...)
	}
	return out
}

func prefixProbeResults(tier string, results []ProviderProbeResult) []ProviderProbeResult {
	out := make([]ProviderProbeResult, len(results))
	for i, r := range results {
		r.Provider = Provider(tier + "/" + string(r.Provider))
		out[i] = r
	}
	return out
}

// RuntimeForceReload applies admin config to both chains.
func (tc *TierChains) RuntimeForceReload(ctx context.Context) {
	if tc == nil {
		return
	}
	if tc.Free != nil {
		tc.Free.RuntimeForceReload(ctx)
	}
	if tc.Pro != nil && tc.Pro != tc.Free {
		tc.Pro.RuntimeForceReload(ctx)
	}
}
