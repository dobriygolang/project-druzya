package roomsapi

import (
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
	roomservice "github.com/sedorofeevd/project-druzya/services/rooms/internal/room/service"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/ws"
)

type Implementation struct {
	roomsv1.UnimplementedRoomsServiceServer
	service roomservice.Service
	hub     *ws.Hub
}

func NewImplementation(svc roomservice.Service, hub *ws.Hub) *Implementation {
	return &Implementation{service: svc, hub: hub}
}
