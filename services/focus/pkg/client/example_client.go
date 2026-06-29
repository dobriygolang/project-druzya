package client

import focusservice "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/service"

// FocusClient is the port for other services — rename per domain.
type FocusClient = focusservice.Service
