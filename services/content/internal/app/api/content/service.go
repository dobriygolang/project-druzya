package contentapi

import (
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
	catalogservice "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/service"
)

// Implementation implements ContentService gRPC handlers.
type Implementation struct {
	contentv1.UnimplementedContentServiceServer
	contentv1.UnimplementedContentAdminServiceServer
	service catalogservice.Service
	pg      *catalogrepo.Pool
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc catalogservice.Service, pg *catalogrepo.Pool) *Implementation {
	return &Implementation{service: svc, pg: pg}
}
