package focusapi

import (
	focusmodel "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/model"
	focusservice "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/service"
	focusv1 "github.com/sedorofeevd/project-druzya/services/focus/pkg/api/focus/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoSession(s *focusmodel.Session) *focusv1.FocusSession {
	if s == nil {
		return nil
	}
	out := &focusv1.FocusSession{
		Id:                 s.ID,
		Mode:               s.Mode,
		PinnedTitle:        s.PinnedTitle,
		StartedAt:          timestamppb.New(s.StartedAt),
		SecondsFocused:     int32(s.SecondsFocused),
		PomodorosCompleted: int32(s.PomodorosCompleted),
	}
	if s.TaskID != nil {
		out.TaskId = *s.TaskID
	}
	if s.EndedAt != nil {
		out.EndedAt = timestamppb.New(*s.EndedAt)
	}
	return out
}

func toProtoFocusDay(d focusmodel.FocusDay) *focusv1.FocusDay {
	return &focusv1.FocusDay{
		Date:     d.Date,
		Seconds:  int32(d.Seconds),
		Sessions: int32(d.Sessions),
	}
}

func mapServiceError(err error) error {
	switch {
	case focusservice.IsNotFound(err):
		return notFound("not found")
	case focusservice.IsInvalidArgument(err):
		return invalidArgument(err.Error())
	default:
		return status.Error(codes.Internal, "internal error")
	}
}
