package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	identityadapter "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/identity"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/repository"
)

type PublishBoardResult struct {
	Slug        string
	URL         string
	PublishedAt model.PublishedBoard
}

func (s *roomService) ShareWhiteboard(ctx context.Context, userID, sceneJSON, title string) (*GuestCreateResult, error) {
	sceneJSON = strings.TrimSpace(sceneJSON)
	if sceneJSON == "" {
		return nil, fmt.Errorf("ShareWhiteboard: scene_json required")
	}
	if s.identity == nil {
		return nil, identityadapter.ErrUnavailable
	}

	roomID := uuid.New()
	guestTTL := s.guestRoomTTL
	scope := fmt.Sprintf("editor:%s", roomID)
	ttlSec := int32(guestTTL.Seconds())
	if ttlSec <= 0 {
		ttlSec = int32(model.DefaultGuestRoomTTL.Seconds())
	}

	displayName := strings.TrimSpace(title)
	if displayName == "" {
		displayName = "hone"
	}

	token, ownerID, err := s.identity.MintScopedAccessToken(ctx, string(model.RoleOwner), scope, displayName, ttlSec)
	if err != nil {
		return nil, fmt.Errorf("ShareWhiteboard mint token: %w", err)
	}
	ownerUUID, err := uuid.Parse(ownerID)
	if err != nil {
		return nil, fmt.Errorf("ShareWhiteboard owner id: %w", err)
	}

	now := s.now().UTC()
	created, err := s.repo.CreateRoomWithID(ctx, roomID, model.Room{
		OwnerID:        ownerUUID,
		Type:           model.RoomTypeSystemDesign,
		Language:       model.LanguageDiagram,
		IsFrozen:       false,
		Visibility:     model.VisibilityShared,
		ExpiresAt:      now.Add(guestTTL),
		IsGuestCreated: true,
	})
	if err != nil {
		return nil, fmt.Errorf("ShareWhiteboard create room: %w", err)
	}

	if err := s.repo.SetInitialScene(ctx, created.ID, sceneJSON); err != nil {
		return nil, fmt.Errorf("ShareWhiteboard seed scene: %w", err)
	}

	ownerRow, err := s.repo.AddParticipant(ctx, model.Participant{
		RoomID:   created.ID,
		UserID:   ownerUUID,
		Role:     model.RoleOwner,
		JoinedAt: now,
	})
	if err != nil {
		return nil, fmt.Errorf("ShareWhiteboard seed owner: %w", err)
	}

	inviteTok, inviteExp, err := model.GenerateInviteToken(created.ID, s.inviteTTL, s.inviteSecret, now)
	if err != nil {
		return nil, fmt.Errorf("ShareWhiteboard invite: %w", err)
	}
	inviteURL := fmt.Sprintf("%s/live/%s?invite=%s", s.publicBaseURL, created.ID, inviteTok)
	invite := &model.InviteLink{URL: inviteURL, Token: inviteTok, ExpiresAt: inviteExp}

	_ = userID // reserved for future billing attribution

	return &GuestCreateResult{
		AccessToken: token,
		ExpiresIn:   ttlSec,
		Room:        s.view(created, []model.Participant{ownerRow}),
		Invite:      invite,
	}, nil
}

func (s *roomService) GetInitialScene(ctx context.Context, userID, roomID string) (string, error) {
	uid, rid, room, participants, err := s.loadRoom(ctx, userID, roomID)
	if err != nil {
		return "", err
	}
	if err := s.ensureAccess(ctx, uid, rid, room, participants); err != nil {
		return "", err
	}
	return s.repo.GetInitialScene(ctx, rid)
}

func (s *roomService) PublishWhiteboard(ctx context.Context, userID, sceneJSON, title string) (*PublishBoardResult, error) {
	sceneJSON = strings.TrimSpace(sceneJSON)
	if sceneJSON == "" {
		return nil, fmt.Errorf("PublishWhiteboard: scene_json required")
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("PublishWhiteboard: invalid user id: %w", err)
	}
	title = strings.TrimSpace(title)
	if title == "" {
		title = "Untitled board"
	}
	slug := repository.NewBoardSlug(title)
	row, err := s.repo.InsertPublishedBoard(ctx, uid, slug, title, sceneJSON)
	if err != nil {
		return nil, fmt.Errorf("PublishWhiteboard: %w", err)
	}
	return &PublishBoardResult{
		Slug: slug,
		URL:  model.BoardPublishURL(s.publicBaseURL, slug),
		PublishedAt: row,
	}, nil
}

func (s *roomService) GetPublishedBoard(ctx context.Context, slug string) (*model.PublishedBoard, error) {
	if strings.TrimSpace(slug) == "" {
		return nil, repository.ErrNotFound
	}
	row, err := s.repo.GetPublishedBoardBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return &row, nil
}
