package repository

import "errors"

// ErrNotFound is returned when a requested session entity does not exist.
var ErrNotFound = errors.New("not found")
