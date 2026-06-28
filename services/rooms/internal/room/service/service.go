package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	billingadapter "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/billing"
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

type ActiveRoomsView struct {
	Rooms                []RoomView
	ActiveCount          int
	ConcurrentLimit      *int
	ConcurrentUnlimited  bool
}

type Service interface {
	CreateRoom(ctx context.Context, userID string, roomType model.RoomType, taskID *string, language model.Language) (*RoomView, error)
	CreateGuestRoom(ctx context.Context, displayName string, roomType model.RoomType, language model.Language) (*GuestCreateResult, error)
	ListMyActiveRooms(ctx context.Context, userID string) (*ActiveRoomsView, error)
	GetRoom(ctx context.Context, userID, roomID string) (*RoomView, error)
	JoinRoom(ctx context.Context, userID, roomID, roleHint, inviteToken string) (*RoomView, error)
	FreezeRoom(ctx context.Context, userID, roomID string, frozen bool) (*RoomView, error)
	CreateInvite(ctx context.Context, userID, roomID string) (*model.InviteLink, error)
	GuestJoin(ctx context.Context, roomID, inviteToken, displayName string) (*GuestJoinResult, error)
}

type roomService struct {
	repo          *repository.Repository
	billing       billingadapter.Client
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
	Billing       billingadapter.Client
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
		billing:       deps.Billing,
		identity:      deps.Identity,
		publicBaseURL: strings.TrimRight(deps.PublicBaseURL, "/"),
		roomTTL:       ttl,
		guestRoomTTL:  guestTTL,
		inviteSecret:  deps.InviteSecret,
		inviteTTL:     inviteTTL,
		now:           time.Now,
	}
}

func (s *roomService) CreateRoom(
	ctx context.Context,
	userID string,
	roomType model.RoomType,
	taskID *string,
	language model.Language,
) (*RoomView, error) {
	ownerID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("CreateRoom: invalid user id: %w", err)
	}
	if roomType == "" {
		roomType = model.RoomTypeInterview
	}
	if language == "" {
		language = model.LanguageGo
	}
	if err := model.ValidateCreate(roomType, language); err != nil {
		return nil, err
	}

	if s.billing != nil {
		if err := s.billing.CheckAndConsumeUsage(ctx, userID, billingadapter.EntitlementLiveRoomsPerMonth, 1); err != nil {
			if errors.Is(err, billingadapter.ErrQuotaExceeded) {
				return nil, repository.ErrQuotaExceeded
			}
			return nil, fmt.Errorf("CreateRoom billing: %w", err)
		}
	}

	if err := s.ensureConcurrentRoomCapacity(ctx, userID, ownerID); err != nil {
		return nil, err
	}

	var taskUUID *uuid.UUID
	if taskID != nil && *taskID != "" {
		parsed, parseErr := uuid.Parse(*taskID)
		if parseErr != nil {
			return nil, fmt.Errorf("CreateRoom: invalid task id: %w", parseErr)
		}
		taskUUID = &parsed
	}

	now := s.now().UTC()
	created, err := s.repo.CreateRoom(ctx, model.Room{
		OwnerID:        ownerID,
		Type:           roomType,
		TaskID:         taskUUID,
		Language:       language,
		IsFrozen:       false,
		Visibility:     model.VisibilityShared,
		ExpiresAt:      now.Add(s.roomTTL),
		IsGuestCreated: false,
	})
	if err != nil {
		return nil, fmt.Errorf("CreateRoom: %w", err)
	}

	ownerRow, err := s.repo.AddParticipant(ctx, model.Participant{
		RoomID:   created.ID,
		UserID:   ownerID,
		Role:     model.RoleOwner,
		JoinedAt: now,
	})
	if err != nil {
		return nil, fmt.Errorf("CreateRoom seed owner: %w", err)
	}

	return s.view(created, []model.Participant{ownerRow}), nil
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
		roomType = model.RoomTypeInterview
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

func (s *roomService) JoinRoom(ctx context.Context, userID, roomID, roleHint, inviteToken string) (*RoomView, error) {
	uid, rid, room, participants, err := s.loadRoom(ctx, userID, roomID)
	if err != nil {
		return nil, err
	}
	if repository.IsExpired(room, s.now().UTC()) {
		return nil, repository.ErrInvalidState
	}

	if _, err := s.repo.GetRole(ctx, rid, uid); err == nil {
		return s.view(room, participants), nil
	} else if !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}

	inviteOK := false
	if inviteToken != "" {
		tokenRoom, vErr := model.ValidateInviteToken(inviteToken, s.inviteSecret, s.now().UTC())
		if vErr != nil {
			return nil, ErrInvalidInvite
		}
		if tokenRoom != rid {
			return nil, ErrInvalidInvite
		}
		inviteOK = true
	}

	if !inviteOK && room.Visibility == model.VisibilityPrivate && uid != room.OwnerID {
		return nil, repository.ErrForbidden
	}

	role := model.RoleForInvitee(room, participants)
	if roleHint != "" {
		switch model.Role(roleHint) {
		case model.RoleInterviewer, model.RoleParticipant, model.RoleViewer:
			role = model.Role(roleHint)
		}
	}

	row, err := s.repo.AddParticipant(ctx, model.Participant{
		RoomID:   rid,
		UserID:   uid,
		Role:     role,
		JoinedAt: s.now().UTC(),
	})
	if err != nil {
		return nil, fmt.Errorf("JoinRoom: %w", err)
	}
	participants = append(participants, row)
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
	if role != model.RoleOwner && role != model.RoleInterviewer {
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
	token, _, err := s.identity.MintScopedAccessToken(ctx, identityjwt.RoleGuest, scope, name, ttlSec)
	if err != nil {
		return nil, fmt.Errorf("GuestJoin mint token: %w", err)
	}

	return &GuestJoinResult{
		AccessToken: token,
		ExpiresIn:   ttlSec,
		Room:        s.view(room, participants),
	}, nil
}

func (s *roomService) ListMyActiveRooms(ctx context.Context, userID string) (*ActiveRoomsView, error) {
	ownerID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("ListMyActiveRooms: invalid user id: %w", err)
	}
	rooms, err := s.repo.ListActiveByOwner(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	gauge, err := s.concurrentGaugeLimit(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := &ActiveRoomsView{
		ActiveCount:         len(rooms),
		ConcurrentLimit:     gauge.Limit,
		ConcurrentUnlimited: gauge.Unlimited,
	}
	for _, room := range rooms {
		out.Rooms = append(out.Rooms, *s.view(room, nil))
	}
	return out, nil
}

func (s *roomService) ensureConcurrentRoomCapacity(ctx context.Context, userID string, ownerID uuid.UUID) error {
	gauge, err := s.concurrentGaugeLimit(ctx, userID)
	if err != nil {
		return err
	}
	if gauge.Unlimited {
		return nil
	}
	if gauge.Limit == nil {
		return nil
	}
	active, err := s.repo.CountActiveByOwner(ctx, ownerID)
	if err != nil {
		return err
	}
	if active >= *gauge.Limit {
		return repository.ErrQuotaExceeded
	}
	return nil
}

func (s *roomService) concurrentGaugeLimit(ctx context.Context, userID string) (billingadapter.GaugeLimit, error) {
	if s.billing == nil {
		return billingadapter.GaugeLimit{Unlimited: true}, nil
	}
	return s.billing.GetGaugeLimit(ctx, userID, billingadapter.EntitlementLiveRoomsConcurrent)
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
