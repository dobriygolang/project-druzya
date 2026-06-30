package notesapi

import (
	notesmodel "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/model"
	notesservice "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/service"
	notesv1 "github.com/sedorofeevd/project-druzya/services/notes/pkg/api/notes/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoNote(n *notesmodel.Note) *notesv1.Note {
	if n == nil {
		return nil
	}
	return &notesv1.Note{
		Id:        n.ID,
		Title:     n.Title,
		BodyMd:    n.BodyMD,
		CreatedAt: timestamppb.New(n.CreatedAt),
		UpdatedAt: timestamppb.New(n.UpdatedAt),
		SizeBytes: int32(n.SizeBytes),
		Encrypted: n.Encrypted,
	}
}

func toProtoNoteSummary(n notesmodel.NoteSummary) *notesv1.NoteSummary {
	return &notesv1.NoteSummary{
		Id:        n.ID,
		Title:     n.Title,
		UpdatedAt: timestamppb.New(n.UpdatedAt),
		SizeBytes: int32(n.SizeBytes),
	}
}

func mapServiceError(err error) error {
	switch {
	case notesservice.IsNotFound(err):
		return notFound("not found")
	case notesservice.IsInvalidArgument(err):
		return invalidArgument(err.Error())
	case notesservice.IsQuotaExceeded(err):
		return status.Error(codes.ResourceExhausted, "cloud notes quota exceeded")
	default:
		return status.Error(codes.Internal, "internal error")
	}
}
