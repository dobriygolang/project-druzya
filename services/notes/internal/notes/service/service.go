package service

import (
	"context"
	"errors"
	"strings"

	billingadapter "github.com/sedorofeevd/project-druzya/services/notes/internal/adapter/billing"
	notesmodel "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/model"
	notesrepo "github.com/sedorofeevd/project-druzya/services/notes/internal/notes/repository"
)

var (
	ErrNotFound        = notesmodel.ErrNotFound
	ErrInvalidArgument = notesmodel.ErrInvalidArgument
	ErrQuotaExceeded   = notesmodel.ErrQuotaExceeded
)

type Service interface {
	InitVault(ctx context.Context, userID string) (saltB64 string, initialized bool, err error)
	GetVaultSalt(ctx context.Context, userID string) (saltB64 string, err error)

	ListNotes(ctx context.Context, userID string, limit int, cursor string) ([]notesmodel.NoteSummary, string, error)
	GetNote(ctx context.Context, userID, id string) (*notesmodel.Note, error)
	CreateNote(ctx context.Context, userID, title, body string) (*notesmodel.Note, error)
	UpdateNote(ctx context.Context, userID, id, title, body string) (*notesmodel.Note, error)
	DeleteNote(ctx context.Context, userID, id string) error

	EncryptNote(ctx context.Context, userID, noteID, ciphertext string) error

	UnpublishNote(ctx context.Context, userID, noteID string) error
	GetPublishStatus(ctx context.Context, userID, noteID string) (*notesmodel.PublishStatus, error)
	ShareNoteToWeb(ctx context.Context, userID, noteID, plaintext string) (*notesmodel.ShareToWebResult, error)
	MakeNotePrivate(ctx context.Context, userID, noteID, ciphertext string) error
	GetPublishedNote(ctx context.Context, slug string) (*notesmodel.PublishedNote, error)
}

type notesService struct {
	repo          notesrepo.Store
	publicBaseURL string
	billing       billingadapter.Client
}

type Deps struct {
	Repo          notesrepo.Store
	PublicBaseURL string
	Billing       billingadapter.Client
}

func New(deps Deps) Service {
	base := strings.TrimRight(deps.PublicBaseURL, "/")
	if base == "" {
		base = "http://localhost:5173"
	}
	billing := deps.Billing
	if billing == nil {
		billing = billingadapter.Noop()
	}
	return &notesService{repo: deps.Repo, publicBaseURL: base, billing: billing}
}

func (s *notesService) InitVault(ctx context.Context, userID string) (string, bool, error) {
	if strings.TrimSpace(userID) == "" {
		return "", false, ErrInvalidArgument
	}
	return s.repo.InitVault(ctx, userID)
}

func (s *notesService) GetVaultSalt(ctx context.Context, userID string) (string, error) {
	if strings.TrimSpace(userID) == "" {
		return "", ErrInvalidArgument
	}
	salt, ok, err := s.repo.GetVaultSalt(ctx, userID)
	if err != nil {
		return "", err
	}
	if !ok {
		return "", ErrNotFound
	}
	return salt, nil
}

func (s *notesService) ListNotes(
	ctx context.Context,
	userID string,
	limit int,
	cursor string,
) ([]notesmodel.NoteSummary, string, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, "", ErrInvalidArgument
	}
	return s.repo.ListNotes(ctx, userID, notesrepo.ListNotesFilter{
		Limit: limit, Cursor: cursor,
	})
}

func (s *notesService) GetNote(ctx context.Context, userID, id string) (*notesmodel.Note, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(id) == "" {
		return nil, ErrInvalidArgument
	}
	return s.repo.GetNote(ctx, userID, id)
}

func (s *notesService) CreateNote(
	ctx context.Context,
	userID, title, body string,
) (*notesmodel.Note, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, ErrInvalidArgument
	}
	if err := s.ensureCloudNotesQuota(ctx, userID); err != nil {
		return nil, err
	}
	return s.repo.CreateNote(ctx, userID, strings.TrimSpace(title), body)
}

func (s *notesService) UpdateNote(ctx context.Context, userID, id, title, body string) (*notesmodel.Note, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(id) == "" {
		return nil, ErrInvalidArgument
	}
	return s.repo.UpdateNote(ctx, userID, id, strings.TrimSpace(title), body)
}

func (s *notesService) DeleteNote(ctx context.Context, userID, id string) error {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(id) == "" {
		return ErrInvalidArgument
	}
	return s.repo.DeleteNote(ctx, userID, id)
}

func (s *notesService) EncryptNote(ctx context.Context, userID, noteID, ciphertext string) error {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(noteID) == "" || ciphertext == "" {
		return ErrInvalidArgument
	}
	return s.repo.EncryptNote(ctx, userID, noteID, ciphertext)
}

func (s *notesService) UnpublishNote(ctx context.Context, userID, noteID string) error {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(noteID) == "" {
		return ErrInvalidArgument
	}
	return s.repo.UnpublishNote(ctx, userID, noteID)
}

func (s *notesService) GetPublishStatus(ctx context.Context, userID, noteID string) (*notesmodel.PublishStatus, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(noteID) == "" {
		return nil, ErrInvalidArgument
	}
	return s.repo.GetPublishStatus(ctx, userID, noteID, s.publicBaseURL)
}

func (s *notesService) ShareNoteToWeb(ctx context.Context, userID, noteID, plaintext string) (*notesmodel.ShareToWebResult, error) {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(noteID) == "" {
		return nil, ErrInvalidArgument
	}
	return s.repo.ShareNoteToWeb(ctx, userID, noteID, plaintext, s.publicBaseURL)
}

func (s *notesService) MakeNotePrivate(ctx context.Context, userID, noteID, ciphertext string) error {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(noteID) == "" || ciphertext == "" {
		return ErrInvalidArgument
	}
	return s.repo.MakeNotePrivate(ctx, userID, noteID, ciphertext)
}

func (s *notesService) GetPublishedNote(ctx context.Context, slug string) (*notesmodel.PublishedNote, error) {
	if strings.TrimSpace(slug) == "" {
		return nil, ErrInvalidArgument
	}
	return s.repo.GetPublishedNoteBySlug(ctx, slug)
}

func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}

func IsInvalidArgument(err error) bool {
	return errors.Is(err, ErrInvalidArgument)
}

func IsQuotaExceeded(err error) bool {
	return errors.Is(err, ErrQuotaExceeded)
}

func (s *notesService) ensureCloudNotesQuota(ctx context.Context, userID string) error {
	limit, err := s.billing.GetGaugeLimit(ctx, userID, billingadapter.EntitlementCloudNotesCount)
	if err != nil || limit.Unlimited || limit.Limit == nil {
		return err
	}
	count, err := s.repo.CountActiveNotes(ctx, userID)
	if err != nil {
		return err
	}
	if count >= *limit.Limit {
		return ErrQuotaExceeded
	}
	return nil
}
