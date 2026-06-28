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
	// ErrTrialAlreadyUsed marks a user who already redeemed the one-time Pro trial.
	ErrTrialAlreadyUsed = errors.New("pro trial already used")
	// ErrAlreadySubscribed marks a user who already has an active paid or trial plan.
	ErrAlreadySubscribed = errors.New("already subscribed")
	// ErrTrialDisabled marks Pro trial when the feature is turned off.
	ErrTrialDisabled = errors.New("pro trial disabled")
)
