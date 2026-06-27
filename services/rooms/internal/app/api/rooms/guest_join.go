package roomsapi

import (
	"context"

	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) GuestJoin(ctx context.Context, req *roomsv1.GuestJoinRequest) (*roomsv1.GuestJoinResponse, error) {
	result, err := i.service.GuestJoin(ctx, req.RoomId, req.InviteToken, req.DisplayName)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &roomsv1.GuestJoinResponse{
		AccessToken: result.AccessToken,
		Room:        toProtoRoom(result.Room),
		ExpiresIn:   result.ExpiresIn,
	}, nil
}
