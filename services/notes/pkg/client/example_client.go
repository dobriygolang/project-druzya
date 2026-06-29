package client

import notesservice "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/service"

// NotesClient is the port for other services — rename per domain.
type NotesClient = notesservice.Service
