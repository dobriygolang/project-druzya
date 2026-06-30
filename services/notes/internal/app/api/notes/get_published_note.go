package notesapi

import (
	"context"

	notesv1 "github.com/sedorofeevd/project-druzya/services/notes/pkg/api/notes/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func (i *Implementation) GetPublishedNote(
	ctx context.Context,
	req *notesv1.GetPublishedNoteRequest,
) (*notesv1.GetPublishedNoteResponse, error) {
	note, err := i.service.GetPublishedNote(ctx, req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.GetPublishedNoteResponse{
		Title:       note.Title,
		BodyMd:      note.BodyMD,
		PublishedAt: timestamppb.New(note.PublishedAt),
	}, nil
}
