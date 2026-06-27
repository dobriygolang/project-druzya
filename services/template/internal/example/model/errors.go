package model

import "errors"

// Domain-level sentinel errors. Keeping them in the model package lets both the
// service and usecase layers reference them without an import cycle.
var (
	// ErrInvalidArgument marks missing or malformed input.
	ErrInvalidArgument = errors.New("invalid argument")
)
