package focusapi

import (
	focusv1 "github.com/sedorofeevd/project-druzya/services/focus/pkg/api/focus/v1"
	focusservice "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/service"
)

// Implementation implements FocusService gRPC handlers.
type Implementation struct {
	focusv1.UnimplementedFocusServiceServer
	service focusservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc focusservice.Service) *Implementation {
	return &Implementation{service: svc}
}
