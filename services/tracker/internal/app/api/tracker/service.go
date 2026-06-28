package trackerapi

import (
	trackerservice "github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/service"
	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	"google.golang.org/grpc"
)

type Implementation struct {
	trackerv1.UnimplementedTrackerServiceServer
	trackerv1.UnimplementedTrackerInternalServiceServer
	svc trackerservice.Service
}

func NewImplementation(svc trackerservice.Service) *Implementation {
	return &Implementation{svc: svc}
}

func Register(s *grpc.Server, impl *Implementation) {
	trackerv1.RegisterTrackerServiceServer(s, impl)
	trackerv1.RegisterTrackerInternalServiceServer(s, impl)
}

func NewRegisteredImplementation(s *grpc.Server, svc trackerservice.Service) *Implementation {
	impl := NewImplementation(svc)
	Register(s, impl)
	return impl
}
