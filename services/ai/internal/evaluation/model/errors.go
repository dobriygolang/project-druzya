package model

import "errors"

// Domain-level sentinel errors shared by the service and usecase layers.
// Defined in the model package to avoid an import cycle between them.
var (
	// ErrInvalidInput marks malformed or missing request input.
	ErrInvalidInput = errors.New("invalid input")
	// ErrEvaluation marks a failed evaluation (LLM/parse error).
	ErrEvaluation = errors.New("evaluation failed")
	// ErrQuotaExceeded marks an exhausted billing quota.
	ErrQuotaExceeded = errors.New("quota exceeded")
)
