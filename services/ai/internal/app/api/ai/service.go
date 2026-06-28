package aiapi

import (
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	llmconfigservice "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/service"
)

// Implementation implements AiInternalService gRPC handlers.
type Implementation struct {
	aiv1.UnimplementedAiInternalServiceServer
	service   evaluationservice.Service
	llmConfig llmconfigservice.Service
	chain     *llmchain.Chain
	pg        *evaluationrepo.Pool
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc evaluationservice.Service, llmConfig llmconfigservice.Service, chain *llmchain.Chain, pg *evaluationrepo.Pool) *Implementation {
	return &Implementation{service: svc, llmConfig: llmConfig, chain: chain, pg: pg}
}
