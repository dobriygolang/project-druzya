package notesapi

import (
	notesv1 "github.com/sedorofeevd/project-druzya/services/notes/pkg/api/notes/v1"
	notesservice "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/service"
	"google.golang.org/grpc"
)

// Register mounts NotesService on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	notesv1.RegisterNotesServiceServer(s, impl)
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(s *grpc.Server, svc notesservice.Service) *Implementation {
	impl := NewImplementation(svc)
	Register(s, impl)
	return impl
}
