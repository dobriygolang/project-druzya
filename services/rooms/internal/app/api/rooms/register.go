package roomsapi

import (
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
	roomservice "github.com/sedorofeevd/project-druzya/services/rooms/internal/room/service"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/ws"
	"google.golang.org/grpc"
)

func Register(s *grpc.Server, impl *Implementation) {
	roomsv1.RegisterRoomsServiceServer(s, impl)
}

func NewRegisteredImplementation(s *grpc.Server, svc roomservice.Service, hub *ws.Hub) *Implementation {
	impl := NewImplementation(svc, hub)
	Register(s, impl)
	return impl
}
