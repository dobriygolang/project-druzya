package roomsapi

import (
	"context"

	"github.com/google/uuid"
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) CloseRoom(ctx context.Context, req *roomsv1.CloseRoomRequest) (*roomsv1.CloseRoomResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.service.CloseRoom(ctx, userID, req.RoomId); err != nil {
		return nil, mapServiceError(err)
	}
	if i.hub != nil {
		if rid, parseErr := uuid.Parse(req.RoomId); parseErr == nil {
			i.hub.CloseRoom(rid)
		}
	}
	return &roomsv1.CloseRoomResponse{}, nil
}
