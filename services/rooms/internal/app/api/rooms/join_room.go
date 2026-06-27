package roomsapi

import (
	"context"

	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) JoinRoom(ctx context.Context, req *roomsv1.JoinRoomRequest) (*roomsv1.JoinRoomResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	view, err := i.service.JoinRoom(ctx, userID, req.RoomId, req.Role, req.InviteToken)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &roomsv1.JoinRoomResponse{Room: toProtoRoom(view)}, nil
}
