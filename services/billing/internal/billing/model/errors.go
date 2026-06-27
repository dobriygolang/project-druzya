package model

import "errors"

// Domain-level sentinel errors shared by the service and usecase layers.
// Defined in the model package to avoid an import cycle between them.
var (
	// ErrInvalidInput marks malformed or missing request input.
	ErrInvalidInput = errors.New("invalid input")
	// ErrUnknownUser marks a provider event referencing an unknown user.
	ErrUnknownUser = errors.New("unknown user")
	// ErrDuplicateEvent marks an already-processed provider event.
	ErrDuplicateEvent = errors.New("duplicate provider event")
)
