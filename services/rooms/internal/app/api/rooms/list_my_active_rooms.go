package roomsapi

import (
	"context"

	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) ListMyActiveRooms(
	ctx context.Context,
	_ *roomsv1.ListMyActiveRoomsRequest,
) (*roomsv1.ListMyActiveRoomsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	view, err := i.service.ListMyActiveRooms(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoListMyActiveRooms(view), nil
}
