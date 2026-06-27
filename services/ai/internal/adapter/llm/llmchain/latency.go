package llmchain

import (
	"slices"
	"sync"
	"time"
)

// Passive latency tracking — rolling window of recent successful call
// durations per (provider, model, task). The chain reads the p95 of each
// healthy candidate and reorders the TaskModelMap slice so that the
// empirically-fastest provider goes first.
//
// Design notes:
//
//   • Successes only. Failure durations (timeouts, 429 round-trips) are
//     signal about provider health, which the circuit-breaker already
//     handles — mixing them into the latency window would bias the
//     "is this provider slow?" decision toward "this provider was
//     failing earlier today".
//
//   • Per-task segmentation. Groq's llama-3.1-8b on CodingHint (short,
//     low-latency hint) has a completely different latency profile than
//     the same provider's llama-3.3-70b on InsightProse (long prose, 400
//     output tokens). Reordering by a global "Groq is fast" would make
//     the wrong decision for one of them; we key by (provider, model,
//     task) so each latency profile stays isolated.
//
//   • Small window (default 50). Large enough to smooth one bad outlier,
//     small enough to react within minutes when a provider genuinely
//     degrades. At ~5 req/min per task on a single-user dev env we fill
//     this in 10 minutes; in production, seconds.
//
//   • Zero extra requests. Everything we record here is a side-effect of
//     a call the chain was going to make anyway. No active probing, no
//     wasted rate-limit budget.
//
// Concurrency: safe for concurrent record+read. The window's slice is
// protected by a mutex because Record and P95 both touch it. The hot
// path (Record) is two writes and a modulo; the cold path (P95 during
// candidate reordering) does a small copy+sort — 50 ints sort in ~1µs.

// defaultWindowSize is how many recent durations we keep per key.
// 50 was picked empirically: at our largest task (copilot chat,
// ~5 req/s), 50 = ~10 seconds of history — enough to notice a sudden
// degradation, short enough that a recovery re-asserts quickly.
const defaultWindowSize = 50

// minSamplesForReorder is the floor below which we trust static order
// over empirical data. A single fast call shouldn't flip the chain;
// we want ~20% of the window filled before letting the p95 drive.
// Translates to "first 10 requests per task per provider use static
// priority", giving the operator's LLM_CHAIN_ORDER a chance to stick.
const minSamplesForReorder = 10

// latencyWindow is a fixed-capacity ring buffer of durations plus a
// fill count. Read via P95; written via Record.
type latencyWindow struct {
	mu     sync.Mutex
	buf    []time.Duration
	idx    int // next write position
	filled int // how many slots have real data (≤ cap)
}

func newLatencyWindow(cap int) *latencyWindow {
	if cap <= 0 {
		cap = defaultWindowSize
	}
	return &latencyWindow{buf: make([]time.Duration, cap)}
}

// Record appends one duration to the ring. Older entries fall off when
// the ring wraps. Durations ≤ 0 (clock skew guard) are ignored.
func (w *latencyWindow) Record(d time.Duration) {
	if d <= 0 {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	w.buf[w.idx] = d
	w.idx = (w.idx + 1) % len(w.buf)
	if w.filled < len(w.buf) {
		w.filled++
	}
}

// P95 returns the 95th-percentile duration and whether the sample is
// sufficient for reordering decisions. The boolean is the caller's
// contract: ignore the duration when false.
//
// Why p95 and not p50/p99: p50 is too forgiving of tail regressions
// (one provider being 2s slower than another 5% of the time matters
// for UX); p99 is too noisy at our sample size. p95 sits on the
// conservative side of "typical slow request".
func (w *latencyWindow) P95() (time.Duration, bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.filled < minSamplesForReorder {
		return 0, false
	}
	// Copy only the populated slice so partially-filled windows don't
	// drag in zero entries that would skew the percentile toward 0.
	out := make([]time.Duration, w.filled)
	copy(out, w.buf[:w.filled])
	slices.Sort(out)
	// Index formula: ceil(0.95 * N) - 1, clamped to last index.
	idx := (95*w.filled + 99) / 100
	if idx >= len(out) {
		idx = len(out) - 1
	}
	return out[idx], true
}

// latencyStore indexes windows by (provider, model, task). The chain
// holds one store; each key gets its own window on first record.
type latencyStore struct {
	windows    sync.Map // key: "<provider>/<model>/<task>" → *latencyWindow
	windowSize int
}

func newLatencyStore(size int) *latencyStore {
	if size <= 0 {
		size = defaultWindowSize
	}
	return &latencyStore{windowSize: size}
}

func (s *latencyStore) key(p Provider, model string, task Task) string {
	return string(p) + "/" + model + "/" + string(task)
}

func (s *latencyStore) Record(p Provider, model string, task Task, d time.Duration) {
	// No-op when task is empty (ModelOverride path): reorder only applies
	// to Task-driven routing, so there's nothing to feed with off-path
	// samples.
	if task == "" {
		return
	}
	k := s.key(p, model, task)
	w, ok := s.windows.Load(k)
	if !ok {
		fresh := newLatencyWindow(s.windowSize)
		actual, _ := s.windows.LoadOrStore(k, fresh)
		w = actual
	}
	w.(*latencyWindow).Record(d)
}

func (s *latencyStore) P95(p Provider, model string, task Task) (time.Duration, bool) {
	if task == "" {
		return 0, false
	}
	k := s.key(p, model, task)
	w, ok := s.windows.Load(k)
	if !ok {
		return 0, false
	}
	return w.(*latencyWindow).P95()
}
