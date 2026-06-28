package roomsapi

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) CreateGuestRoom(ctx context.Context, req *roomsv1.CreateGuestRoomRequest) (*roomsv1.CreateGuestRoomResponse, error) {
	result, err := i.service.CreateGuestRoom(ctx, req.DisplayName, defaultRoomType(req.RoomType), defaultLanguage(req.Language))
	if err != nil {
		return nil, mapServiceError(err)
	}
	resp := &roomsv1.CreateGuestRoomResponse{
		AccessToken: result.AccessToken,
		Room:        toProtoRoom(result.Room),
		ExpiresIn:   result.ExpiresIn,
	}
	if result.Invite != nil {
		resp.Invite = &roomsv1.InviteLink{
			Url:       result.Invite.URL,
			Token:     result.Invite.Token,
			ExpiresAt: timestamppb.New(result.Invite.ExpiresAt),
		}
	}
	return resp, nil
}
