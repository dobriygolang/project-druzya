package service

import (
	"context"

	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

// Repository is evaluation persistence used by the domain service.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Repository --output=./mocks --outpkg=mocks --filename=repository.go
type Repository interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	CreateJob(ctx context.Context, job *evaluationmodel.EvaluationJob) error
	GetJobByID(ctx context.Context, id string) (*evaluationmodel.EvaluationJob, error)
	GetJobByAttemptID(ctx context.Context, attemptID string) (*evaluationmodel.EvaluationJob, error)
	ListJobs(ctx context.Context, status *evaluationmodel.JobStatus, limit int) ([]evaluationmodel.EvaluationJob, error)
	UpdateJob(ctx context.Context, job *evaluationmodel.EvaluationJob) error
	CreateModelCall(ctx context.Context, call *evaluationmodel.ModelCall) error
	CountModelCalls(ctx context.Context, jobID string) (int, error)
}
