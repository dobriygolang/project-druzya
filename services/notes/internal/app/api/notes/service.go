package notesapi

import (
	notesv1 "github.com/sedorofeevd/project-druzya/services/notes/pkg/api/notes/v1"
	notesservice "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/service"
)

// Implementation implements NotesService gRPC handlers.
type Implementation struct {
	notesv1.UnimplementedNotesServiceServer
	service notesservice.Service
}

// NewImplementation constructs the gRPC transport layer.
func NewImplementation(svc notesservice.Service) *Implementation {
	return &Implementation{service: svc}
}
