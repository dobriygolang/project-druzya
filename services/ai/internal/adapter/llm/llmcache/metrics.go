package llmcache

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	cacheHits = promauto.NewCounter(prometheus.CounterOpts{
		Name: "llm_prompt_cache_hits_total",
		Help: "LLM Chat calls served from exact prompt cache",
	})
	cacheMisses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "llm_prompt_cache_misses_total",
		Help: "LLM Chat calls that reached the upstream provider",
	})
	savedTokens = promauto.NewCounter(prometheus.CounterOpts{
		Name: "llm_prompt_cache_saved_tokens_total",
		Help: "Estimated upstream tokens avoided by prompt cache hits",
	})
	memoryEntries = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "llm_prompt_cache_memory_entries",
		Help: "In-memory LLM prompt cache entry count",
	})
)

func IncHit(tokensIn, tokensOut int) {
	cacheHits.Inc()
	if tokensIn+tokensOut > 0 {
		savedTokens.Add(float64(tokensIn + tokensOut))
	}
}

func IncMiss() { cacheMisses.Inc() }

func SetMemoryEntries(n int) { memoryEntries.Set(float64(n)) }
