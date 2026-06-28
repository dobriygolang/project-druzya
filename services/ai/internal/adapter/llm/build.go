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
	Caveman             string
}

// BuildChainOpts configures llmchain assembly.
type BuildChainOpts struct {
	Config              BuildConfig
	Log                 *slog.Logger
	RuntimeConfigSource llmchain.ConfigSource
	RuntimeCtx          context.Context
}

// BuildChain assembles the provider chain from environment config.
// Returns nil chain when no API keys are configured (caller should use fake client).
func BuildChain(opts BuildChainOpts) (llmchain.ChatClient, *llmchain.Chain, error) {
	cfg := opts.Config
	log := opts.Log
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
		RuntimeConfigSource: opts.RuntimeConfigSource,
		RuntimeCtx:          opts.RuntimeCtx,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("build llm chain: %w", err)
	}
	return caveman.New(chain, caveman.ParseLevel(cfg.Caveman), log), chain, nil
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
