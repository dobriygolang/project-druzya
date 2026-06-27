package aiapi

import (
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
)

// Implementation implements AiInternalService gRPC handlers.
type Implementation struct {
	aiv1.UnimplementedAiInternalServiceServer
	service evaluationservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc evaluationservice.Service) *Implementation {
	return &Implementation{service: svc}
}
