package llmchain

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// rateState tracks the health of one (provider,model) pair. Safe for
// concurrent use across goroutines — we serialize reads + writes with a
// mutex rather than atomic.Value because the hot path (check+maybe-skip)
// is cheap and the write path (on every response) needs to update two
// fields atomically.
//
// Fields:
//
//   - blockedUntil — until when this (provider,model) is cooled. Zero
//     value = healthy. Set by circuit-breaker decisions (429/5xx/401)
//     AND by proactive cooling when remaining drops ≤ 2.
//
//   - reason — human-readable last cooldown reason. Logged on every
//     skip so we can answer "why is the chain bouncing off Groq?" in
//     one Grafana panel.
//
//   - remaining / resetAt — the latest x-ratelimit-* budget reading.
//     Kept separately from blockedUntil so a "soft hint" (remaining=5,
//     reset=+30s) stays informational until it trips the ≤2 threshold.
type rateState struct {
	mu           sync.Mutex
	provider     Provider
	model        string
	blockedUntil time.Time
	reason       string
	needsProbe   bool
	remaining    int
	resetAt      time.Time
}

func (s *rateState) blocked(now time.Time) (bool, time.Time, string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return now.Before(s.blockedUntil) || s.needsProbe, s.blockedUntil, s.reason
}

func (s *rateState) block(until time.Time, reason string) {
	s.blockWithProbe(until, reason, true)
}

func (s *rateState) blockWithProbe(until time.Time, reason string, needsProbe bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// Never shorten an existing cooldown — a long 401 (1h) must not be
	// overwritten by a later 429 with a 30s hint.
	if until.After(s.blockedUntil) {
		s.blockedUntil = until
		s.reason = reason
	}
	s.needsProbe = s.needsProbe || needsProbe
}

func (s *rateState) clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.blockedUntil = time.Time{}
	s.reason = ""
	s.needsProbe = false
}

func (s *rateState) probeDue(now time.Time) (Provider, string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.needsProbe || now.Before(s.blockedUntil) {
		return "", "", false
	}
	return s.provider, s.model, true
}

// recordResponse ingests the latest known budget from a success response.
// When remaining drops to ≤ 2 AND a resetAt is known, we pre-emptively
// cool this pair until resetAt. The threshold is deliberately conservative
// (2, not 0): the rate-limit window reset can arrive mid-refresh, leading
// to a race where the counter decrements after reset — a small margin
// absorbs that without ever hitting an actual 429.
func (s *rateState) recordResponse(remaining int, resetAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.remaining = remaining
	s.resetAt = resetAt
	if remaining > 0 && remaining <= 2 && !resetAt.IsZero() {
		if resetAt.After(s.blockedUntil) {
			s.blockedUntil = resetAt
			s.reason = "preemptive: near rate-limit floor"
			s.needsProbe = false
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────
// Header parsing — one helper per provider.
//
// Headers return (remaining, resetAt). Values come back (−1, zero) when
// the header is absent / unparsable; callers treat that as "unknown" and
// skip the proactive-cooling path.
//
// Groq:     x-ratelimit-remaining-requests / x-ratelimit-reset-requests
//           (reset is "12s" / "1m23s" duration, not absolute timestamp)
// Cerebras: identical shape to Groq (both are OpenAI SDK mirrors)
// OpenRouter: x-ratelimit-remaining / x-ratelimit-reset
//           (reset is a unix ms timestamp as a string)
// Mistral: lacks documented rate-limit headers on free tier; parser
//           returns (−1, zero) and we fall back to reactive-only cooling.
// ─────────────────────────────────────────────────────────────────────────

func parseRateLimitHeaders(p Provider, h http.Header, now time.Time) (remaining int, resetAt time.Time) {
	switch p {
	case ProviderGroq, ProviderCerebras:
		// Groq/Cerebras (оба OpenAI SDK-derived): x-ratelimit-remaining-
		// requests + x-ratelimit-reset-requests (Go-style duration string).
		return parseGroqLikeHeaders(h, now)
	case ProviderOpenRouter:
		return parseOpenRouterHeaders(h, now)
	case ProviderMistral, ProviderGoogle, ProviderCloudflare, ProviderZAI, ProviderDeepSeek, ProviderOllama:
		// Эти провайдеры не отдают rate-limit headers (Mistral free, Ollama
		// self-hosted, DeepSeek paid per-token). Откатываемся к
		// реактивному cooldown по факту 429/5xx.
		return -1, time.Time{}
	default:
		return -1, time.Time{}
	}
}

func parseGroqLikeHeaders(h http.Header, now time.Time) (int, time.Time) {
	rem := parseIntHeader(h.Get("x-ratelimit-remaining-requests"))
	// Reset is a Go-style duration string ("12s", "1m30s"). Absolute-
	// timestamp flavor has been seen in the wild too, we accept both.
	resetRaw := strings.TrimSpace(h.Get("x-ratelimit-reset-requests"))
	resetAt := parseResetHeader(resetRaw, now)
	return rem, resetAt
}

func parseOpenRouterHeaders(h http.Header, now time.Time) (int, time.Time) {
	rem := parseIntHeader(h.Get("x-ratelimit-remaining"))
	resetRaw := strings.TrimSpace(h.Get("x-ratelimit-reset"))
	// OpenRouter emits reset as unix ms.
	if resetRaw == "" {
		return rem, time.Time{}
	}
	if ms, err := strconv.ParseInt(resetRaw, 10, 64); err == nil && ms > 0 {
		return rem, time.Unix(0, ms*int64(time.Millisecond))
	}
	return rem, parseResetHeader(resetRaw, now)
}

// parseResetHeader handles Go-style durations ("12s", "1m30s") as well
// as plain-seconds integers. Returns zero Time on failure — caller
// treats that as "unknown".
func parseResetHeader(raw string, now time.Time) time.Time {
	if raw == "" {
		return time.Time{}
	}
	if d, err := time.ParseDuration(raw); err == nil && d > 0 {
		return now.Add(d)
	}
	if n, err := strconv.Atoi(raw); err == nil && n > 0 {
		return now.Add(time.Duration(n) * time.Second)
	}
	return time.Time{}
}

func parseIntHeader(raw string) int {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return -1
	}
	if n, err := strconv.Atoi(raw); err == nil {
		return n
	}
	// Some providers emit float-ish "0.0" — round down.
	if f, err := strconv.ParseFloat(raw, 64); err == nil {
		return int(f)
	}
	return -1
}

// parseRetryAfter handles the Retry-After header in its two canonical
// formats: plain seconds ("30") and HTTP-date ("Wed, 21 Oct 2015 07:28:00 GMT").
// Returns 0 when unparsable — callers fall back to the chain's default
// cooldown.
func parseRetryAfter(h string, now time.Time) time.Duration {
	h = strings.TrimSpace(h)
	if h == "" {
		return 0
	}
	if n, err := strconv.Atoi(h); err == nil && n > 0 {
		return time.Duration(n) * time.Second
	}
	if t, err := http.ParseTime(h); err == nil {
		if d := t.Sub(now); d > 0 {
			return d
		}
	}
	return 0
}
