package contentapi

import (
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	catalogservice "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/service"
)

// Implementation implements ContentService gRPC handlers.
type Implementation struct {
	contentv1.UnimplementedContentServiceServer
	service catalogservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc catalogservice.Service) *Implementation {
	return &Implementation{service: svc}
}
