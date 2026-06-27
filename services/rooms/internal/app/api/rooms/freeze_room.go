package roomsapi

import (
	"context"

	"github.com/google/uuid"
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) FreezeRoom(ctx context.Context, req *roomsv1.FreezeRoomRequest) (*roomsv1.FreezeRoomResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	view, err := i.service.FreezeRoom(ctx, userID, req.RoomId, req.Frozen)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if i.hub != nil {
		if rid, parseErr := uuid.Parse(req.RoomId); parseErr == nil {
			i.hub.BroadcastFreeze(rid, req.Frozen, parseUserActor(userID))
		}
	}
	return &roomsv1.FreezeRoomResponse{Room: toProtoRoom(view)}, nil
}
