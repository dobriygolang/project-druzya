package roomsapi

import (
	"context"
	"bytes"

	"github.com/google/uuid"
	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
)

func (i *Implementation) GetReplay(ctx context.Context, req *roomsv1.GetReplayRequest) (*roomsv1.GetReplayResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if _, err := i.service.GetRoom(ctx, userID, req.RoomId); err != nil {
		return nil, mapServiceError(err)
	}
	if i.hub == nil {
		return &roomsv1.GetReplayResponse{}, nil
	}
	rid, err := uuid.Parse(req.RoomId)
	if err != nil {
		return nil, invalidArgument("invalid room id")
	}
	payload := i.hub.FlushRoom(rid)
	opCount := int32(bytes.Count(payload, []byte("\n")))
	if len(payload) > 0 && payload[len(payload)-1] != '\n' {
		opCount++
	}
	return &roomsv1.GetReplayResponse{
		PayloadJsonl: payload,
		OpCount:      opCount,
	}, nil
}
