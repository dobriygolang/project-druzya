package notesapi

import (
	"context"

	notesv1 "github.com/sedorofeevd/project-druzya/services/notes/pkg/api/notes/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func (i *Implementation) InitVault(ctx context.Context, _ *notesv1.InitVaultRequest) (*notesv1.InitVaultResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	salt, initialized, err := i.service.InitVault(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.InitVaultResponse{SaltB64: salt, Initialized: initialized}, nil
}

func (i *Implementation) GetVaultSalt(ctx context.Context, _ *notesv1.GetVaultSaltRequest) (*notesv1.GetVaultSaltResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	salt, err := i.service.GetVaultSalt(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.GetVaultSaltResponse{SaltB64: salt, Initialized: true}, nil
}

func (i *Implementation) EncryptNote(ctx context.Context, req *notesv1.EncryptNoteRequest) (*notesv1.EncryptNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.service.EncryptNote(ctx, userID, req.GetNoteId(), req.GetCiphertextB64()); err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.EncryptNoteResponse{}, nil
}

func (i *Implementation) PermanentlyDecryptNote(
	ctx context.Context,
	req *notesv1.PermanentlyDecryptNoteRequest,
) (*notesv1.PermanentlyDecryptNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.service.PermanentlyDecryptNote(ctx, userID, req.GetNoteId(), req.GetBodyMd()); err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.PermanentlyDecryptNoteResponse{}, nil
}

func (i *Implementation) ListNotes(ctx context.Context, req *notesv1.ListNotesRequest) (*notesv1.ListNotesResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	notes, next, err := i.service.ListNotes(ctx, userID, int(req.GetLimit()), req.GetCursor(), optionalFolderID(req.GetFolderId()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &notesv1.ListNotesResponse{NextCursor: next}
	for _, n := range notes {
		out.Notes = append(out.Notes, toProtoNoteSummary(n))
	}
	return out, nil
}

func (i *Implementation) GetNote(ctx context.Context, req *notesv1.GetNoteRequest) (*notesv1.GetNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	note, err := i.service.GetNote(ctx, userID, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.GetNoteResponse{Note: toProtoNote(note)}, nil
}

func (i *Implementation) CreateNote(ctx context.Context, req *notesv1.CreateNoteRequest) (*notesv1.CreateNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	note, err := i.service.CreateNote(ctx, userID, req.GetTitle(), req.GetBodyMd(), optionalFolderID(req.GetFolderId()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.CreateNoteResponse{Note: toProtoNote(note)}, nil
}

func (i *Implementation) UpdateNote(ctx context.Context, req *notesv1.UpdateNoteRequest) (*notesv1.UpdateNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	note, err := i.service.UpdateNote(ctx, userID, req.GetId(), req.GetTitle(), req.GetBodyMd())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.UpdateNoteResponse{Note: toProtoNote(note)}, nil
}

func (i *Implementation) DeleteNote(ctx context.Context, req *notesv1.DeleteNoteRequest) (*notesv1.DeleteNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.service.DeleteNote(ctx, userID, req.GetId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.DeleteNoteResponse{}, nil
}

func (i *Implementation) MoveNote(ctx context.Context, req *notesv1.MoveNoteRequest) (*notesv1.MoveNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	note, err := i.service.MoveNote(ctx, userID, req.GetNoteId(), optionalFolderID(req.GetFolderId()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.MoveNoteResponse{Note: toProtoNote(note)}, nil
}

func (i *Implementation) GetNotesMeta(ctx context.Context, _ *notesv1.GetNotesMetaRequest) (*notesv1.GetNotesMetaResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	meta, err := i.service.GetNotesMeta(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &notesv1.GetNotesMetaResponse{}
	for _, m := range meta {
		out.Notes = append(out.Notes, &notesv1.NoteMeta{
			Id: m.ID, Encrypted: m.Encrypted, Published: m.Published,
		})
	}
	return out, nil
}

func (i *Implementation) ListFolders(ctx context.Context, _ *notesv1.ListFoldersRequest) (*notesv1.ListFoldersResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	folders, err := i.service.ListFolders(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &notesv1.ListFoldersResponse{}
	for _, f := range folders {
		out.Folders = append(out.Folders, toProtoFolder(&f))
	}
	return out, nil
}

func (i *Implementation) CreateFolder(ctx context.Context, req *notesv1.CreateFolderRequest) (*notesv1.CreateFolderResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	folder, err := i.service.CreateFolder(ctx, userID, req.GetName(), optionalFolderID(req.GetParentId()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.CreateFolderResponse{Folder: toProtoFolder(folder)}, nil
}

func (i *Implementation) DeleteFolder(ctx context.Context, req *notesv1.DeleteFolderRequest) (*notesv1.DeleteFolderResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.service.DeleteFolder(ctx, userID, req.GetId(), req.GetMoveNotesToRoot()); err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.DeleteFolderResponse{}, nil
}

func (i *Implementation) PublishNote(ctx context.Context, req *notesv1.PublishNoteRequest) (*notesv1.PublishNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	st, err := i.service.PublishNote(ctx, userID, req.GetNoteId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &notesv1.PublishNoteResponse{Slug: st.Slug, Url: st.URL}
	if st.PublishedAt != nil {
		out.PublishedAt = timestamppb.New(*st.PublishedAt)
	}
	return out, nil
}

func (i *Implementation) UnpublishNote(ctx context.Context, req *notesv1.UnpublishNoteRequest) (*notesv1.UnpublishNoteResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.service.UnpublishNote(ctx, userID, req.GetNoteId()); err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.UnpublishNoteResponse{}, nil
}

func (i *Implementation) GetPublishStatus(
	ctx context.Context,
	req *notesv1.GetPublishStatusRequest,
) (*notesv1.GetPublishStatusResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	st, err := i.service.GetPublishStatus(ctx, userID, req.GetNoteId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &notesv1.GetPublishStatusResponse{
		Published: st.Published,
		Slug:      st.Slug,
		Url:       st.URL,
	}
	if st.PublishedAt != nil {
		out.PublishedAt = timestamppb.New(*st.PublishedAt)
	}
	return out, nil
}

func (i *Implementation) ShareNoteToWeb(
	ctx context.Context,
	req *notesv1.ShareNoteToWebRequest,
) (*notesv1.ShareNoteToWebResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	res, err := i.service.ShareNoteToWeb(ctx, userID, req.GetNoteId(), req.GetPlaintextMd())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.ShareNoteToWebResponse{
		Slug:             res.Slug,
		Url:              res.URL,
		PublishedAt:      timestamppb.New(res.PublishedAt),
		AlreadyPublished: res.AlreadyPublished,
	}, nil
}

func (i *Implementation) MakeNotePrivate(
	ctx context.Context,
	req *notesv1.MakeNotePrivateRequest,
) (*notesv1.MakeNotePrivateResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if err := i.service.MakeNotePrivate(ctx, userID, req.GetNoteId(), req.GetCiphertextB64()); err != nil {
		return nil, mapServiceError(err)
	}
	return &notesv1.MakeNotePrivateResponse{}, nil
}
