package service

import (
	"errors"

	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

var (
	ErrNotFound                = interviewrepo.ErrNotFound
	ErrActiveSessionExists     = interviewrepo.ErrActiveSessionExists
	ErrConflict                = interviewrepo.ErrConflict
	ErrRetryItemsUnavailable   = interviewrepo.ErrRetryItemsUnavailable
	ErrForbidden               = errors.New("forbidden")
	ErrInvalidInput            = errors.New("invalid input")
	ErrSessionClosed           = errors.New("session closed")
)

func IsNotFound(err error) bool  { return errors.Is(err, ErrNotFound) }
func IsForbidden(err error) bool  { return errors.Is(err, ErrForbidden) }
func IsInvalidInput(err error) bool { return errors.Is(err, ErrInvalidInput) }
