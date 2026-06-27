package llmchain

import (
	"errors"
	"fmt"
	"time"
)

// Error classification drives the chain's fallback decisions. Every
// driver MUST return one of these sentinels (wrapped with fmt.Errorf
// %w for context) so the chain can decide whether to try the next
// provider or surface the failure immediately.
//
// The split mirrors HTTP semantics:
//
//   - Retryable (ErrRateLimited, ErrProviderDown, ErrTimeout) — same
//     input may succeed on a different provider. Chain falls through.
//
//   - Fatal-for-this-call (ErrBadRequest, ErrUnauthorized,
//     ErrModelNotSupported) — same input will fail identically
//     everywhere (400) or needs operator action (401). Chain returns
//     the error immediately without fallback.
//
//   - ErrAllProvidersUnavailable — chain-level terminal error raised
//     when every provider in the order returned a retryable error.
//     Wraps a list of per-provider attempt results for debugging.
var (
	// ErrRateLimited — 429 from the upstream. Includes a suggested
	// cooldown parsed from Retry-After / x-ratelimit-reset when
	// available; 0 means "use the chain default".
	ErrRateLimited = errors.New("llmchain: rate limited")

	// ErrProviderDown — 5xx response or transport failure. Cooled for
	// the chain's default 5xx window (60s).
	ErrProviderDown = errors.New("llmchain: provider down")

	// ErrTimeout — context deadline exceeded at the attempt level.
	// Treated like a 5xx — cooldown then next provider.
	ErrTimeout = errors.New("llmchain: attempt timeout")

	// ErrBadRequest — 400 from the upstream. Same-input will fail
	// everywhere; chain returns immediately. No cooldown (the fault
	// is with the caller's payload, not the provider).
	ErrBadRequest = errors.New("llmchain: bad request")

	// ErrUnauthorized — 401/403. Indicates a config problem. Chain
	// cools for 1h AND emits an operator alert (via log.Error). The
	// long cooldown avoids hammering the provider while the operator
	// rotates keys; the alert makes the operator actually rotate them.
	ErrUnauthorized = errors.New("llmchain: unauthorized")

	// ErrModelNotSupported — the driver cannot serve this model/feature
	// (e.g. caller asked for images on a text-only provider). Chain
	// tries the next provider without cooling this one — the provider
	// is healthy, it just can't handle this task.
	ErrModelNotSupported = errors.New("llmchain: model or feature not supported")

	// ErrNoProvider — the chain has no driver registered for the
	// provider the caller picked via ModelOverride. Fatal for the
	// call; not a chain-retry condition.
	ErrNoProvider = errors.New("llmchain: no provider registered")
)

// AttemptError captures what happened on one chain hop. A slice of
// these becomes the payload of ErrAllProvidersUnavailable so logs/UI
// can display the exact cause chain.
type AttemptError struct {
	Provider Provider
	Model    string
	Status   int // HTTP status, or 0 for transport/context failures
	Err      error
	Duration time.Duration
}

func (a AttemptError) String() string {
	if a.Status > 0 {
		return fmt.Sprintf("%s/%s: %d %v (%s)", a.Provider, a.Model, a.Status, a.Err, a.Duration)
	}
	return fmt.Sprintf("%s/%s: %v (%s)", a.Provider, a.Model, a.Err, a.Duration)
}

// AllProvidersUnavailableError is the chain-level terminal error raised
// when every provider in the order failed with a retryable class.
// Exposes the per-provider attempt list so callers can surface a
// human-readable reason.
type AllProvidersUnavailableError struct {
	Task     Task
	Attempts []AttemptError
}

func (e *AllProvidersUnavailableError) Error() string {
	return fmt.Sprintf("llmchain: all providers unavailable for task %q (%d attempts)",
		e.Task, len(e.Attempts))
}

// Is allows errors.Is(err, ErrAllProvidersUnavailable) to work without
// exporting a second sentinel.
var ErrAllProvidersUnavailable = errors.New("llmchain: all providers unavailable")

func (e *AllProvidersUnavailableError) Is(target error) bool {
	return target == ErrAllProvidersUnavailable
}
