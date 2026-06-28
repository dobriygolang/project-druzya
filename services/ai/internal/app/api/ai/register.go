package aiapi

import (
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	llmconfigservice "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/service"
	"google.golang.org/grpc"
)

// Register mounts AiInternalService on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	aiv1.RegisterAiInternalServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc evaluationservice.Service, llmConfig llmconfigservice.Service, chains *llmchain.TierChains, pg *evaluationrepo.Pool) *Implementation {
	impl := NewImplementation(svc, llmConfig, chains, pg)
	Register(s, impl)
	return impl
}
