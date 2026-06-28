package roomsapi

import (
	"errors"

	"github.com/google/uuid"
	"google.golang.org/protobuf/types/known/timestamppb"

	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
	roomservice "github.com/sedorofeevd/project-druzya/services/rooms/internal/room/service"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	identityadapter "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/identity"
)

func toProtoRoom(view *roomservice.RoomView) *roomsv1.Room {
	if view == nil {
		return nil
	}
	room := view.Room
	out := &roomsv1.Room{
		Id:             room.ID.String(),
		OwnerId:        room.OwnerID.String(),
		RoomType:       room.Type.String(),
		Language:       room.Language.String(),
		IsFrozen:       room.IsFrozen,
		Visibility:     string(room.Visibility),
		WsUrl:          view.WSURL,
		ExpiresAt:      timestamppb.New(room.ExpiresAt),
		CreatedAt:      timestamppb.New(room.CreatedAt),
		IsGuestCreated: room.IsGuestCreated,
	}
	if room.TaskID != nil {
		taskID := room.TaskID.String()
		out.TaskId = &taskID
	}
	for _, p := range view.Participants {
		out.Participants = append(out.Participants, &roomsv1.Participant{
			UserId:   p.UserID.String(),
			Role:     p.Role.String(),
			JoinedAt: timestamppb.New(p.JoinedAt),
		})
	}
	return out
}

func toProtoListMyActiveRooms(view *roomservice.ActiveRoomsView) *roomsv1.ListMyActiveRoomsResponse {
	if view == nil {
		return &roomsv1.ListMyActiveRoomsResponse{}
	}
	out := &roomsv1.ListMyActiveRoomsResponse{
		ActiveCount:         int32(view.ActiveCount),
		ConcurrentUnlimited: view.ConcurrentUnlimited,
	}
	if view.ConcurrentLimit != nil {
		limit := int32(*view.ConcurrentLimit)
		out.ConcurrentLimit = &limit
	}
	for _, roomView := range view.Rooms {
		room := roomView.Room
		out.Rooms = append(out.Rooms, &roomsv1.ActiveRoomSummary{
			Id:             room.ID.String(),
			RoomType:       room.Type.String(),
			Language:       room.Language.String(),
			CreatedAt:      timestamppb.New(room.CreatedAt),
			ExpiresAt:      timestamppb.New(room.ExpiresAt),
			IsGuestCreated: room.IsGuestCreated,
			WsUrl:          roomView.WSURL,
		})
	}
	return out
}

func mapServiceError(err error) error {
	if err == nil {
		return nil
	}
	if roomservice.IsNotFound(err) {
		return notFound("room not found")
	}
	if roomservice.IsForbidden(err) {
		return permissionDenied("forbidden")
	}
	if roomservice.IsQuotaExceeded(err) {
		return failedPrecondition("room quota exceeded")
	}
	if roomservice.IsInvalidInvite(err) {
		return permissionDenied("invalid or expired invite")
	}
	if errors.Is(err, identityadapter.ErrUnavailable) {
		return status.Errorf(codes.Unavailable, "guest join unavailable")
	}
	return status.Errorf(codes.Internal, "internal error")
}

func parseUserActor(userID string) uuid.UUID {
	id, _ := uuid.Parse(userID)
	return id
}

func defaultLanguage(lang string) model.Language {
	if lang == "" {
		return model.LanguageGo
	}
	return model.Language(lang)
}

func defaultRoomType(t string) model.RoomType {
	if t == "" {
		return model.RoomTypeInterview
	}
	return model.RoomType(t)
}
