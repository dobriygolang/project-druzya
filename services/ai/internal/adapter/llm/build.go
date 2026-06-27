package llm

import (
	"fmt"
	"log/slog"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain/caveman"
)

// BuildConfig holds provider keys and chain order for llmchain assembly.
type BuildConfig struct {
	Order    string
	OpenAI   string
	Groq     string
	Cerebras string
	Google   string
	Mistral  string
	Caveman  string
}

// BuildChain assembles the provider chain from environment config.
// Returns nil when no API keys are configured (caller should use fake client).
func BuildChain(cfg BuildConfig, log *slog.Logger) (llmchain.ChatClient, error) {
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
	addKeys("openai", cfg.OpenAI, llmchain.NewOpenAIProviderDriver)

	if len(drivers) == 0 {
		return nil, nil
	}

	chain, err := llmchain.NewChain(drivers, llmchain.Options{
		Order: parseChainOrder(cfg.Order),
		Log:   log,
	})
	if err != nil {
		return nil, fmt.Errorf("build llm chain: %w", err)
	}
	return caveman.New(chain, caveman.ParseLevel(cfg.Caveman), log), nil
}

func parseChainOrder(raw string) []llmchain.Provider {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return []llmchain.Provider{
			llmchain.ProviderGroq,
			llmchain.ProviderCerebras,
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
