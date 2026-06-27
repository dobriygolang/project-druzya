package service

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
)

// Service is AI evaluation use cases.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Service --output=./mocks --outpkg=mocks --filename=service.go
type Service interface {
	RunEvaluation(ctx context.Context, attemptID string) error
	HandleAttemptSubmitted(ctx context.Context, event evaluationmodel.AttemptSubmittedEvent) error
	GetEvaluationJob(ctx context.Context, id string) (*evaluationmodel.EvaluationJob, error)
	GetEvaluationJobByAttemptID(ctx context.Context, attemptID string) (*evaluationmodel.EvaluationJob, error)
	ListEvaluationJobs(ctx context.Context, status *evaluationmodel.JobStatus, limit int) ([]evaluationmodel.EvaluationJob, error)
}

type evaluationService struct {
	repo       Repository
	interview  interviewadapter.Client
	content    contentadapter.Client
	evaluator  evaluator.Client
	maxRetries int
}

// Deps holds service dependencies.
type Deps struct {
	Repo       Repository
	Interview  interviewadapter.Client
	Content    contentadapter.Client
	Evaluator  evaluator.Client
	MaxRetries int
}

// New constructs evaluation service.
func New(deps Deps) Service {
	maxRetries := deps.MaxRetries
	if maxRetries <= 0 {
		maxRetries = 3
	}
	return &evaluationService{
		repo:       deps.Repo,
		interview:  deps.Interview,
		content:    deps.Content,
		evaluator:  deps.Evaluator,
		maxRetries: maxRetries,
	}
}
