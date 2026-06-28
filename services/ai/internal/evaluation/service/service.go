package service

import (
	"context"

	billingadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing"
	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/evaluator"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/usecase/command/run_evaluation"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/summary"
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
	GenerateProfileSummary(ctx context.Context, userID string, readiness int, skills []summary.SkillScore, locale string) (string, error)
}

type evaluationService struct {
	repo       Repository
	interview  interviewadapter.Client
	content    contentadapter.Client
	billing    billingadapter.Client
	evaluator  evaluator.Client
	summary    *summary.Generator
	maxRetries int

	// CQRS usecase handler. RunEvaluation/HandleAttemptSubmitted delegate here.
	runEvaluation *run_evaluation.Handler
}

// Deps holds service dependencies.
type Deps struct {
	Repo       Repository
	Interview  interviewadapter.Client
	Content    contentadapter.Client
	Billing    billingadapter.Client
	Evaluator  evaluator.Client
	Summary    *summary.Generator
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
		billing:    deps.Billing,
		evaluator:  deps.Evaluator,
		summary:    deps.Summary,
		maxRetries: maxRetries,
		runEvaluation: run_evaluation.New(run_evaluation.Deps{
			Repo:       deps.Repo,
			Interview:  deps.Interview,
			Content:    deps.Content,
			Billing:    deps.Billing,
			Evaluator:  deps.Evaluator,
			MaxRetries: maxRetries,
		}),
	}
}
