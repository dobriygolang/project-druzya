package roomsapi

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) GetPublishedBoard(
	ctx context.Context,
	req *roomsv1.GetPublishedBoardRequest,
) (*roomsv1.GetPublishedBoardResponse, error) {
	board, err := i.service.GetPublishedBoard(ctx, req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &roomsv1.GetPublishedBoardResponse{
		Title:       board.Title,
		SceneJson:   board.SceneJSON,
		PublishedAt: timestamppb.New(board.PublishedAt),
	}, nil
}
