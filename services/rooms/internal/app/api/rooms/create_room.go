package roomsapi

import (
	"context"

	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) CreateRoom(ctx context.Context, req *roomsv1.CreateRoomRequest) (*roomsv1.CreateRoomResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	var taskID *string
	if req.TaskId != nil {
		taskID = req.TaskId
	}
	view, err := i.service.CreateRoom(ctx, userID, defaultRoomType(req.RoomType), taskID, defaultLanguage(req.Language))
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &roomsv1.CreateRoomResponse{Room: toProtoRoom(view)}, nil
}
