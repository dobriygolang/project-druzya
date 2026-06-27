package interviewapi

import (
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
)

// Implementation implements Interview gRPC handlers.
type Implementation struct {
	interviewv1.UnimplementedInterviewServiceServer
	interviewv1.UnimplementedInterviewInternalServiceServer
	service interviewservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc interviewservice.Service) *Implementation {
	return &Implementation{service: svc}
}
