package model

import "errors"

// Domain-level sentinel errors shared by the service and usecase layers.
// Keeping them in the model package avoids an import cycle between
// service and usecase packages.
var (
	// ErrInvalidInput marks malformed or missing request input.
	ErrInvalidInput = errors.New("invalid input")
	// ErrSessionClosed marks operations on a non-active session.
	ErrSessionClosed = errors.New("session closed")
	// ErrSessionPaused marks mutations while the session is paused.
	ErrSessionPaused = errors.New("session paused")
)
