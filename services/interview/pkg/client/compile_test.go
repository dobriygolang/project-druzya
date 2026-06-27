package client_test

import (
	"testing"

	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	"github.com/sedorofeevd/project-druzya/services/interview/pkg/client"
)

func TestServiceImplementsClientPorts(t *testing.T) {
	t.Parallel()

	var _ client.Client = interviewservice.Service(nil)
	var _ client.InternalClient = interviewservice.Service(nil)
}
