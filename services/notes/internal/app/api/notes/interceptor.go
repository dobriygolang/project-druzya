package notesapi

import (
	"context"
	"strings"

	notesv1 "github.com/sedorofeevd/project-druzya/services/notes/pkg/api/notes/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
)

var protectedMethods = map[string]struct{}{
	notesv1.NotesService_InitVault_FullMethodName:              {},
	notesv1.NotesService_GetVaultSalt_FullMethodName:             {},
	notesv1.NotesService_EncryptNote_FullMethodName:              {},
	notesv1.NotesService_PermanentlyDecryptNote_FullMethodName:   {},
	notesv1.NotesService_ListNotes_FullMethodName:                {},
	notesv1.NotesService_GetNote_FullMethodName:                  {},
	notesv1.NotesService_CreateNote_FullMethodName:               {},
	notesv1.NotesService_UpdateNote_FullMethodName:               {},
	notesv1.NotesService_DeleteNote_FullMethodName:               {},
	notesv1.NotesService_MoveNote_FullMethodName:                 {},
	notesv1.NotesService_GetNotesMeta_FullMethodName:             {},
	notesv1.NotesService_ListFolders_FullMethodName:              {},
	notesv1.NotesService_CreateFolder_FullMethodName:             {},
	notesv1.NotesService_DeleteFolder_FullMethodName:             {},
	notesv1.NotesService_PublishNote_FullMethodName:              {},
	notesv1.NotesService_UnpublishNote_FullMethodName:            {},
	notesv1.NotesService_GetPublishStatus_FullMethodName:         {},
	notesv1.NotesService_ShareNoteToWeb_FullMethodName:           {},
	notesv1.NotesService_MakeNotePrivate_FullMethodName:          {},
}

func AuthInterceptor(v *jwt.Validator) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if _, ok := protectedMethods[info.FullMethod]; !ok {
			return handler(ctx, req)
		}
		token := BearerTokenFromContext(ctx)
		userID, err := v.UserID(token)
		if err != nil {
			return nil, unauthorized()
		}
		return handler(WithUserID(ctx, userID), req)
	}
}

func optionalFolderID(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}
