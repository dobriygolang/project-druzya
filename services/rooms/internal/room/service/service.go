package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	identityadapter "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/identity"
	identityjwt "github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/repository"
)

var (
	ErrNotFound      = repository.ErrNotFound
	ErrInvalidInvite = model.ErrInvalidInvite
)

type RoomView struct {
	Room         model.Room
	Participants []model.Participant
	WSURL        string
}

type GuestJoinResult struct {
	AccessToken string
	ExpiresIn   int32
	Room        *RoomView
}

type GuestCreateResult struct {
	AccessToken string
	ExpiresIn   int32
	Room        *RoomView
	Invite      *model.InviteLink
}

type Service interface {
	CreateGuestRoom(ctx context.Context, displayName string, roomType model.RoomType, language model.Language) (*GuestCreateResult, error)
	GetRoom(ctx context.Context, userID, roomID string) (*RoomView, error)
	FreezeRoom(ctx context.Context, userID, roomID string, frozen bool) (*RoomView, error)
	CreateInvite(ctx context.Context, userID, roomID string) (*model.InviteLink, error)
	CloseRoom(ctx context.Context, userID, roomID string) error
	GuestJoin(ctx context.Context, roomID, inviteToken, displayName string) (*GuestJoinResult, error)
	ShareWhiteboard(ctx context.Context, userID, sceneJSON, title string) (*GuestCreateResult, error)
	GetInitialScene(ctx context.Context, userID, roomID string) (string, error)
	PublishWhiteboard(ctx context.Context, userID, sceneJSON, title string) (*PublishBoardResult, error)
	GetPublishedBoard(ctx context.Context, slug string) (*model.PublishedBoard, error)
}

type roomService struct {
	repo          *repository.Repository
	identity      identityadapter.TokenMinter
	publicBaseURL string
	roomTTL       time.Duration
	guestRoomTTL  time.Duration
	inviteSecret  []byte
	inviteTTL     time.Duration
	now           func() time.Time
}

type Deps struct {
	Repo          *repository.Repository
	Identity      identityadapter.TokenMinter
	PublicBaseURL string
	RoomTTL       time.Duration
	GuestRoomTTL  time.Duration
	InviteSecret  []byte
	InviteTTL     time.Duration
}

func New(deps Deps) Service {
	ttl := deps.RoomTTL
	if ttl <= 0 {
		ttl = model.DefaultRoomTTL
	}
	inviteTTL := deps.InviteTTL
	if inviteTTL <= 0 {
		inviteTTL = model.DefaultInviteTTL
	}
	guestTTL := deps.GuestRoomTTL
	if guestTTL <= 0 {
		guestTTL = model.DefaultGuestRoomTTL
	}
	return &roomService{
		repo:          deps.Repo,
		identity:      deps.Identity,
		publicBaseURL: strings.TrimRight(deps.PublicBaseURL, "/"),
		roomTTL:       ttl,
		guestRoomTTL:  guestTTL,
		inviteSecret:  deps.InviteSecret,
		inviteTTL:     inviteTTL,
		now:           time.Now,
	}
}

func (s *roomService) CreateGuestRoom(
	ctx context.Context,
	displayName string,
	roomType model.RoomType,
	language model.Language,
) (*GuestCreateResult, error) {
	if s.identity == nil {
		return nil, identityadapter.ErrUnavailable
	}
	if roomType == "" {
		roomType = model.RoomTypePractice
	}
	if language == "" {
		language = model.LanguageGo
	}
	if err := model.ValidateCreate(roomType, language); err != nil {
		return nil, err
	}

	name := strings.TrimSpace(displayName)
	if name == "" {
		name = "guest"
	}

	roomID := uuid.New()
	guestTTL := s.guestRoomTTL
	scope := fmt.Sprintf("editor:%s", roomID)
	ttlSec := int32(guestTTL.Seconds())
	if ttlSec <= 0 {
		ttlSec = int32(model.DefaultGuestRoomTTL.Seconds())
	}

	token, ownerID, err := s.identity.MintScopedAccessToken(ctx, string(model.RoleOwner), scope, name, ttlSec)
	if err != nil {
		return nil, fmt.Errorf("CreateGuestRoom mint token: %w", err)
	}
	ownerUUID, err := uuid.Parse(ownerID)
	if err != nil {
		return nil, fmt.Errorf("CreateGuestRoom owner id: %w", err)
	}

	now := s.now().UTC()
	created, err := s.repo.CreateRoomWithID(ctx, roomID, model.Room{
		OwnerID:        ownerUUID,
		Type:           roomType,
		Language:       language,
		IsFrozen:       false,
		Visibility:     model.VisibilityShared,
		ExpiresAt:      now.Add(guestTTL),
		IsGuestCreated: true,
	})
	if err != nil {
		return nil, fmt.Errorf("CreateGuestRoom: %w", err)
	}

	ownerRow, err := s.repo.AddParticipant(ctx, model.Participant{
		RoomID:   created.ID,
		UserID:   ownerUUID,
		Role:     model.RoleOwner,
		JoinedAt: now,
	})
	if err != nil {
		return nil, fmt.Errorf("CreateGuestRoom seed owner: %w", err)
	}

	inviteTok, inviteExp, err := model.GenerateInviteToken(created.ID, s.inviteTTL, s.inviteSecret, now)
	if err != nil {
		return nil, fmt.Errorf("CreateGuestRoom invite: %w", err)
	}
	inviteURL := fmt.Sprintf("%s/live/%s?invite=%s", s.publicBaseURL, created.ID, inviteTok)
	invite := &model.InviteLink{URL: inviteURL, Token: inviteTok, ExpiresAt: inviteExp}

	return &GuestCreateResult{
		AccessToken: token,
		ExpiresIn:   ttlSec,
		Room:        s.view(created, []model.Participant{ownerRow}),
		Invite:      invite,
	}, nil
}

func (s *roomService) GetRoom(ctx context.Context, userID, roomID string) (*RoomView, error) {
	uid, rid, room, participants, err := s.loadRoom(ctx, userID, roomID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureAccess(ctx, uid, rid, room, participants); err != nil {
		return nil, err
	}
	return s.view(room, participants), nil
}

func (s *roomService) FreezeRoom(ctx context.Context, userID, roomID string, frozen bool) (*RoomView, error) {
	uid, rid, _, participants, err := s.loadRoom(ctx, userID, roomID)
	if err != nil {
		return nil, err
	}
	role, err := s.repo.GetRole(ctx, rid, uid)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return nil, repository.ErrForbidden
		}
		return nil, err
	}
	if role != model.RoleOwner {
		return nil, repository.ErrForbidden
	}

	updated, err := s.repo.UpdateFreeze(ctx, rid, frozen)
	if err != nil {
		return nil, err
	}
	return s.view(updated, participants), nil
}

func (s *roomService) CreateInvite(ctx context.Context, userID, roomID string) (*model.InviteLink, error) {
	uid, rid, room, _, err := s.loadRoom(ctx, userID, roomID)
	if err != nil {
		return nil, err
	}
	if uid != room.OwnerID {
		return nil, repository.ErrForbidden
	}

	tok, expires, err := model.GenerateInviteToken(rid, s.inviteTTL, s.inviteSecret, s.now().UTC())
	if err != nil {
		return nil, fmt.Errorf("CreateInvite: %w", err)
	}
	url := fmt.Sprintf("%s/live/%s?invite=%s", s.publicBaseURL, rid, tok)
	return &model.InviteLink{URL: url, Token: tok, ExpiresAt: expires}, nil
}

func (s *roomService) CloseRoom(ctx context.Context, userID, roomID string) error {
	uid, rid, room, _, err := s.loadRoom(ctx, userID, roomID)
	if err != nil {
		return err
	}
	if uid != room.OwnerID {
		return repository.ErrForbidden
	}
	return s.repo.ArchiveRoom(ctx, rid, uid)
}

func (s *roomService) GuestJoin(ctx context.Context, roomID, inviteToken, displayName string) (*GuestJoinResult, error) {
	if s.identity == nil {
		return nil, identityadapter.ErrUnavailable
	}
	if inviteToken == "" {
		return nil, ErrInvalidInvite
	}
	name := strings.TrimSpace(displayName)
	if name == "" {
		name = "guest"
	}

	rid, err := uuid.Parse(roomID)
	if err != nil {
		return nil, fmt.Errorf("invalid room id: %w", err)
	}
	tokenRoom, err := model.ValidateInviteToken(inviteToken, s.inviteSecret, s.now().UTC())
	if err != nil {
		return nil, ErrInvalidInvite
	}
	if tokenRoom != rid {
		return nil, ErrInvalidInvite
	}

	room, err := s.repo.GetRoom(ctx, rid)
	if err != nil {
		return nil, err
	}
	if repository.IsExpired(room, s.now().UTC()) {
		return nil, repository.ErrInvalidState
	}
	if room.Visibility == model.VisibilityPrivate {
		return nil, repository.ErrForbidden
	}

	participants, err := s.repo.ListParticipants(ctx, rid)
	if err != nil {
		return nil, err
	}

	scope := fmt.Sprintf("editor:%s", rid)
	ttlSec := int32(s.inviteTTL.Seconds())
	token, guestUserID, err := s.identity.MintScopedAccessToken(ctx, identityjwt.RoleGuest, scope, name, ttlSec)
	if err != nil {
		return nil, fmt.Errorf("GuestJoin mint token: %w", err)
	}
	guestUUID, err := uuid.Parse(guestUserID)
	if err != nil {
		return nil, fmt.Errorf("GuestJoin guest id: %w", err)
	}
	if row, err := s.repo.AddParticipant(ctx, model.Participant{
		RoomID:   rid,
		UserID:   guestUUID,
		Role:     model.RoleParticipant,
		JoinedAt: s.now().UTC(),
	}); err != nil {
		return nil, fmt.Errorf("GuestJoin participant: %w", err)
	} else {
		participants = append(participants, row)
	}

	return &GuestJoinResult{
		AccessToken: token,
		ExpiresIn:   ttlSec,
		Room:        s.view(room, participants),
	}, nil
}

func (s *roomService) loadRoom(ctx context.Context, userID, roomID string) (uuid.UUID, uuid.UUID, model.Room, []model.Participant, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return uuid.Nil, uuid.Nil, model.Room{}, nil, fmt.Errorf("invalid user id: %w", err)
	}
	rid, err := uuid.Parse(roomID)
	if err != nil {
		return uuid.Nil, uuid.Nil, model.Room{}, nil, fmt.Errorf("invalid room id: %w", err)
	}
	room, err := s.repo.GetRoom(ctx, rid)
	if err != nil {
		return uuid.Nil, uuid.Nil, model.Room{}, nil, err
	}
	participants, err := s.repo.ListParticipants(ctx, rid)
	if err != nil {
		return uuid.Nil, uuid.Nil, model.Room{}, nil, err
	}
	return uid, rid, room, participants, nil
}

func (s *roomService) ensureAccess(ctx context.Context, uid, rid uuid.UUID, room model.Room, participants []model.Participant) error {
	if uid == room.OwnerID {
		return nil
	}
	for _, p := range participants {
		if p.UserID == uid {
			return nil
		}
	}
	if room.Visibility == model.VisibilityShared {
		return nil
	}
	if _, err := s.repo.GetRole(ctx, rid, uid); errors.Is(err, repository.ErrNotFound) {
		return repository.ErrForbidden
	}
	return nil
}

func (s *roomService) view(room model.Room, participants []model.Participant) *RoomView {
	return &RoomView{
		Room:         room,
		Participants: participants,
		WSURL:        fmt.Sprintf("/ws/editor/%s", room.ID),
	}
}

func IsNotFound(err error) bool {
	return errors.Is(err, repository.ErrNotFound)
}

func IsForbidden(err error) bool {
	return errors.Is(err, repository.ErrForbidden)
}

func IsQuotaExceeded(err error) bool {
	return errors.Is(err, repository.ErrQuotaExceeded)
}

func IsInvalidInvite(err error) bool {
	return errors.Is(err, model.ErrInvalidInvite)
}
