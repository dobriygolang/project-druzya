package service

import (
	"errors"

	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
)

var (
	ErrNotFound     = evaluationrepo.ErrNotFound
	ErrConflict     = evaluationrepo.ErrConflict
	ErrInvalidInput   = errors.New("invalid input")
	ErrEvaluation     = errors.New("evaluation failed")
	ErrQuotaExceeded  = errors.New("quota exceeded")
)

func IsNotFound(err error) bool     { return errors.Is(err, ErrNotFound) }
func IsInvalidInput(err error) bool { return errors.Is(err, ErrInvalidInput) }

func isNotFound(err error) bool  { return errors.Is(err, ErrNotFound) }
func isConflict(err error) bool  { return errors.Is(err, ErrConflict) }
