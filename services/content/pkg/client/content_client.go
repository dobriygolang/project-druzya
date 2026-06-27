package client

import catalogservice "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/service"

// ContentClient is the port for other services to read catalog data.
type ContentClient = catalogservice.Service
