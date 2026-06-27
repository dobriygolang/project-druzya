package repository

import "errors"

var (
	// ErrNotFound is returned when an entity does not exist.
	ErrNotFound = errors.New("not found")
	// ErrConflict is returned on unique constraint violations.
	ErrConflict = errors.New("conflict")
)
