package repository

import "errors"

var (
	ErrNotFound       = errors.New("room: not found")
	ErrForbidden      = errors.New("room: forbidden")
	ErrInvalidState   = errors.New("room: invalid state")
	ErrQuotaExceeded  = errors.New("room: quota exceeded")
)
