package roomsapi

import (
	"context"

	"google.golang.org/protobuf/types/known/timestamppb"
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) PublishWhiteboard(
	ctx context.Context,
	req *roomsv1.PublishWhiteboardRequest,
) (*roomsv1.PublishWhiteboardResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	result, err := i.service.PublishWhiteboard(ctx, userID, req.GetSceneJson(), req.GetTitle())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &roomsv1.PublishWhiteboardResponse{
		Slug:        result.Slug,
		Url:         result.URL,
		PublishedAt: timestamppb.New(result.PublishedAt.PublishedAt),
	}, nil
}
