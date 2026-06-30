package repository

import (
	"context"

	notesmodel "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/model"
)

type ListNotesFilter struct {
	Limit  int
	Cursor string
}

// Store is the persistence port consumed by the domain layer.
type Store interface {
	InitVault(ctx context.Context, userID string) (saltB64 string, initialized bool, err error)
	GetVaultSalt(ctx context.Context, userID string) (saltB64 string, ok bool, err error)

	ListNotes(ctx context.Context, userID string, f ListNotesFilter) ([]notesmodel.NoteSummary, string, error)
	GetNote(ctx context.Context, userID, id string) (*notesmodel.Note, error)
	CreateNote(ctx context.Context, userID, title, body string) (*notesmodel.Note, error)
	UpdateNote(ctx context.Context, userID, id, title, body string) (*notesmodel.Note, error)
	DeleteNote(ctx context.Context, userID, id string) error
	CountActiveNotes(ctx context.Context, userID string) (int, error)
	SumActiveNoteBytes(ctx context.Context, userID string) (int64, error)

	EncryptNote(ctx context.Context, userID, noteID, ciphertext string) error

	UnpublishNote(ctx context.Context, userID, noteID string) error
	GetPublishStatus(ctx context.Context, userID, noteID, publicBaseURL string) (*notesmodel.PublishStatus, error)
	ShareNoteToWeb(ctx context.Context, userID, noteID, plaintext, publicBaseURL string) (*notesmodel.ShareToWebResult, error)
	MakeNotePrivate(ctx context.Context, userID, noteID, ciphertext string) error
	GetPublishedNoteBySlug(ctx context.Context, slug string) (*notesmodel.PublishedNote, error)
}

var _ Store = (*Repository)(nil)
