package repository

import "errors"

var (
	// ErrNotFound is returned when an entity does not exist.
	ErrNotFound = errors.New("not found")
	// ErrActiveSessionExists is returned when user already has an active session.
	ErrActiveSessionExists = errors.New("active session already exists")
	// ErrConflict is returned on unique constraint violations.
	ErrConflict = errors.New("conflict")
	// ErrRetryItemsUnavailable is returned when retry items cannot be claimed.
	ErrRetryItemsUnavailable = errors.New("retry items unavailable")
)
