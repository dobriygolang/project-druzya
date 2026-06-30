package roomsapi

import (
	"context"

	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) GetInitialScene(
	ctx context.Context,
	req *roomsv1.GetInitialSceneRequest,
) (*roomsv1.GetInitialSceneResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	scene, err := i.service.GetInitialScene(ctx, userID, req.GetRoomId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &roomsv1.GetInitialSceneResponse{SceneJson: scene}, nil
}
