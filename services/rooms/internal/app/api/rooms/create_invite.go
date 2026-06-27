package roomsapi

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) CreateInvite(ctx context.Context, req *roomsv1.CreateInviteRequest) (*roomsv1.CreateInviteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	link, err := i.service.CreateInvite(ctx, userID, req.RoomId)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &roomsv1.CreateInviteResponse{
		Invite: &roomsv1.InviteLink{
			Url:       link.URL,
			Token:     link.Token,
			ExpiresAt: timestamppb.New(link.ExpiresAt),
		},
	}, nil
}
