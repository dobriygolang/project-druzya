package service

import "errors"

var (
	// ErrNotFound is returned when a user does not exist.
	ErrNotFound = errors.New("user not found")
	// ErrAlreadyExists is returned when email is already registered.
	ErrAlreadyExists = errors.New("user already exists")
)
