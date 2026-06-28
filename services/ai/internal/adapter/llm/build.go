package llm

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain/caveman"
)

// BuildConfig holds provider keys and chain order for llmchain assembly.
type BuildConfig struct {
	Order               string
	OpenAI              string
	Groq                string
	Cerebras            string
	Google              string
	Mistral             string
	OpenRouter          string
	Cloudflare          string
	CloudflareAccountID string
	DeepSeek            string
	Caveman             string
}

// TierBuildConfig wires separate free vs paid provider keys and chain order.
type TierBuildConfig struct {
	FreeChainOrder string
	PaidChainOrder string
	Free           BuildConfig
	Paid           BuildConfig
	Caveman        string
}

// BuildChainOpts configures llmchain assembly.
type BuildChainOpts struct {
	Config              BuildConfig
	Log                 *slog.Logger
	RuntimeConfigSource llmchain.ConfigSource
	RuntimeCtx          context.Context
}

// BuildTierChainOpts configures free/pro chain assembly for eval routing.
type BuildTierChainOpts struct {
	Config              TierBuildConfig
	Log                 *slog.Logger
	RuntimeConfigSource llmchain.ConfigSource
	RuntimeCtx          context.Context
}

// BuildChain assembles a single provider chain from environment config.
// Returns nil chain when no API keys are configured (caller should use fake client).
func BuildChain(opts BuildChainOpts) (llmchain.ChatClient, *llmchain.Chain, error) {
	return buildOneChain(opts.Config, chainBuildOpts{
		log:                 opts.Log,
		runtimeConfigSource: opts.RuntimeConfigSource,
		runtimeCtx:          opts.RuntimeCtx,
	})
}

// BuildTierChains assembles free and paid chains plus a TierRouter for eval.
// Free chain is required; paid chain is optional (pro users fall back to free).
func BuildTierChains(opts BuildTierChainOpts) (llmchain.ChatClient, *llmchain.TierChains, error) {
	log := opts.Log
	if log == nil {
		log = slog.Default()
	}
	cfg := opts.Config

	freeCfg := cfg.Free
	freeCfg.Order = firstNonEmpty(freeCfg.Order, cfg.FreeChainOrder, "groq,cloudflare,openrouter")
	freeCfg.Caveman = cfg.Caveman

	freeClient, freeChain, err := buildOneChain(freeCfg, chainBuildOpts{
		log:                 log,
		runtimeConfigSource: opts.RuntimeConfigSource,
		runtimeCtx:          opts.RuntimeCtx,
	})
	if err != nil {
		return nil, nil, err
	}
	if freeChain == nil {
		return nil, nil, fmt.Errorf("free LLM chain requires at least one API key")
	}

	paidCfg := cfg.Paid
	paidCfg.Order = firstNonEmpty(paidCfg.Order, cfg.PaidChainOrder, "deepseek,groq")
	paidCfg.Caveman = cfg.Caveman

	var proClient llmchain.ChatClient
	var proChain *llmchain.Chain
	proClient, proChain, err = buildOneChain(paidCfg, chainBuildOpts{
		log:                 log,
		runtimeConfigSource: opts.RuntimeConfigSource,
		runtimeCtx:          opts.RuntimeCtx,
	})
	if err != nil {
		return nil, nil, err
	}
	if proChain == nil {
		log.Warn("paid LLM chain not configured; pro users will use free chain")
		proClient = freeClient
		proChain = freeChain
	}

	chains := &llmchain.TierChains{Free: freeChain, Pro: proChain}
	router := llmchain.NewTierRouter(freeClient, proClient, chains, log)
	return router, chains, nil
}

type chainBuildOpts struct {
	log                 *slog.Logger
	runtimeConfigSource llmchain.ConfigSource
	runtimeCtx          context.Context
}

func buildOneChain(cfg BuildConfig, opts chainBuildOpts) (llmchain.ChatClient, *llmchain.Chain, error) {
	log := opts.log
	if log == nil {
		log = slog.Default()
	}

	drivers := map[llmchain.Provider]llmchain.Driver{}
	wrapMulti := func(p llmchain.Provider, ds []llmchain.Driver) llmchain.Driver {
		if len(ds) == 1 {
			return ds[0]
		}
		return llmchain.NewMultiKeyDriver(p, ds, log)
	}

	addKeys := func(name string, keysCSV string, mk func(string) llmchain.Driver) {
		keys := splitKeys(keysCSV)
		if len(keys) == 0 {
			return
		}
		p := llmchain.Provider(name)
		ds := make([]llmchain.Driver, 0, len(keys))
		for _, k := range keys {
			ds = append(ds, mk(k))
		}
		drivers[p] = wrapMulti(p, ds)
	}

	addKeys("groq", cfg.Groq, llmchain.NewGroqDriver)
	addKeys("cerebras", cfg.Cerebras, llmchain.NewCerebrasDriver)
	addKeys("google", cfg.Google, llmchain.NewGoogleDriver)
	addKeys("mistral", cfg.Mistral, llmchain.NewMistralDriver)
	addKeys("openrouter", cfg.OpenRouter, llmchain.NewOpenRouterDriver)
	addKeys("deepseek", cfg.DeepSeek, llmchain.NewDeepSeekDriver)
	addKeys("openai", cfg.OpenAI, llmchain.NewOpenAIProviderDriver)

	if cfg.Cloudflare != "" && cfg.CloudflareAccountID != "" {
		keys := splitKeys(cfg.Cloudflare)
		ds := make([]llmchain.Driver, 0, len(keys))
		for _, k := range keys {
			if d := llmchain.NewCloudflareDriver(k, cfg.CloudflareAccountID); d != nil {
				ds = append(ds, d)
			}
		}
		if len(ds) > 0 {
			drivers[llmchain.ProviderCloudflare] = wrapMulti(llmchain.ProviderCloudflare, ds)
		}
	}

	if len(drivers) == 0 {
		return nil, nil, nil
	}

	chain, err := llmchain.NewChain(drivers, llmchain.Options{
		Order:               parseChainOrder(cfg.Order),
		Log:                 log,
		RuntimeConfigSource: opts.runtimeConfigSource,
		RuntimeCtx:          opts.runtimeCtx,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("build llm chain: %w", err)
	}
	client := caveman.New(chain, caveman.ParseLevel(cfg.Caveman), log)
	return client, chain, nil
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func parseChainOrder(raw string) []llmchain.Provider {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []llmchain.Provider{
			llmchain.ProviderGroq,
			llmchain.ProviderCerebras,
			llmchain.ProviderGoogle,
			llmchain.ProviderCloudflare,
			llmchain.ProviderOpenRouter,
		}
	}
	parts := strings.Split(raw, ",")
	out := make([]llmchain.Provider, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(strings.ToLower(p))
		if p != "" && p != "fake" {
			out = append(out, llmchain.Provider(p))
		}
	}
	return out
}

func splitKeys(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
