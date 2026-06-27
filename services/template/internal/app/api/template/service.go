package templateapi

import (
	templatev1 "github.com/sedorofeevd/project-druzya/services/template/pkg/api/template/v1"
	exampleservice "github.com/sedorofeevd/project-druzya/services/template/internal/example/service"
)

// Implementation implements TemplateService gRPC handlers.
type Implementation struct {
	templatev1.UnimplementedTemplateServiceServer
	service exampleservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc exampleservice.Service) *Implementation {
	return &Implementation{service: svc}
}
