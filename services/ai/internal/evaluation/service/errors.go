package service

import (
	"errors"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
)

var (
	ErrNotFound      = evaluationrepo.ErrNotFound
	ErrConflict      = evaluationrepo.ErrConflict
	ErrInvalidInput  = evaluationmodel.ErrInvalidInput
	ErrEvaluation    = evaluationmodel.ErrEvaluation
	ErrQuotaExceeded = evaluationmodel.ErrQuotaExceeded
)

func IsNotFound(err error) bool      { return errors.Is(err, ErrNotFound) }
func IsInvalidInput(err error) bool  { return errors.Is(err, ErrInvalidInput) }
func IsQuotaExceeded(err error) bool { return errors.Is(err, ErrQuotaExceeded) }
