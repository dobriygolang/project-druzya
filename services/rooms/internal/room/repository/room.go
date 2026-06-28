package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/model"
)

// Pool wraps pgx connection pool.
type Pool struct {
	*pgxpool.Pool
}

// NewPool creates a PostgreSQL connection pool.
func NewPool(ctx context.Context, dsn string) (*Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Pool{Pool: pool}, nil
}

// Repository persists code rooms and participants.
type Repository struct {
	pg *Pool
}

// New constructs a room repository.
func New(pg *Pool) *Repository {
	return &Repository{pg: pg}
}

func (r *Repository) CreateRoom(ctx context.Context, room model.Room) (model.Room, error) {
	const q = `
INSERT INTO code_rooms (owner_id, room_type, task_id, language, is_frozen, visibility, expires_at, is_guest_created)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, owner_id, room_type, task_id, language, is_frozen, visibility, expires_at, created_at, is_guest_created`

	var out model.Room
	var taskID *uuid.UUID
	var roomType, lang, vis string
	err := r.pg.QueryRow(ctx, q,
		room.OwnerID, room.Type.String(), room.TaskID, room.Language.String(),
		room.IsFrozen, room.Visibility, room.ExpiresAt, room.IsGuestCreated,
	).Scan(
		&out.ID, &out.OwnerID, &roomType, &taskID, &lang,
		&out.IsFrozen, &vis, &out.ExpiresAt, &out.CreatedAt, &out.IsGuestCreated,
	)
	if err != nil {
		return model.Room{}, fmt.Errorf("CreateRoom: %w", err)
	}
	out.Type = model.RoomType(roomType)
	out.Language = model.Language(lang)
	out.Visibility = model.Visibility(vis)
	out.TaskID = taskID
	return out, nil
}

func (r *Repository) CreateRoomWithID(ctx context.Context, id uuid.UUID, room model.Room) (model.Room, error) {
	const q = `
INSERT INTO code_rooms (id, owner_id, room_type, task_id, language, is_frozen, visibility, expires_at, is_guest_created)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, owner_id, room_type, task_id, language, is_frozen, visibility, expires_at, created_at, is_guest_created`

	var out model.Room
	var taskID *uuid.UUID
	var roomType, lang, vis string
	err := r.pg.QueryRow(ctx, q,
		id, room.OwnerID, room.Type.String(), room.TaskID, room.Language.String(),
		room.IsFrozen, room.Visibility, room.ExpiresAt, room.IsGuestCreated,
	).Scan(
		&out.ID, &out.OwnerID, &roomType, &taskID, &lang,
		&out.IsFrozen, &vis, &out.ExpiresAt, &out.CreatedAt, &out.IsGuestCreated,
	)
	if err != nil {
		return model.Room{}, fmt.Errorf("CreateRoomWithID: %w", err)
	}
	out.Type = model.RoomType(roomType)
	out.Language = model.Language(lang)
	out.Visibility = model.Visibility(vis)
	out.TaskID = taskID
	return out, nil
}

func (r *Repository) GetRoom(ctx context.Context, id uuid.UUID) (model.Room, error) {
	const q = `
SELECT id, owner_id, room_type, task_id, language, is_frozen, visibility, expires_at, created_at, is_guest_created
FROM code_rooms
WHERE id = $1 AND archived_at IS NULL`

	var out model.Room
	var roomType, lang, vis string
	var taskID *uuid.UUID
	err := r.pg.QueryRow(ctx, q, id).Scan(
		&out.ID, &out.OwnerID, &roomType, &taskID, &lang,
		&out.IsFrozen, &vis, &out.ExpiresAt, &out.CreatedAt, &out.IsGuestCreated,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.Room{}, ErrNotFound
		}
		return model.Room{}, fmt.Errorf("GetRoom: %w", err)
	}
	out.Type = model.RoomType(roomType)
	out.Language = model.Language(lang)
	out.Visibility = model.Visibility(vis)
	out.TaskID = taskID
	return out, nil
}

func (r *Repository) UpdateFreeze(ctx context.Context, id uuid.UUID, frozen bool) (model.Room, error) {
	const q = `
UPDATE code_rooms SET is_frozen = $2, updated_at = now()
WHERE id = $1 AND archived_at IS NULL
RETURNING id, owner_id, room_type, task_id, language, is_frozen, visibility, expires_at, created_at, is_guest_created`

	var out model.Room
	var roomType, lang, vis string
	var taskID *uuid.UUID
	err := r.pg.QueryRow(ctx, q, id, frozen).Scan(
		&out.ID, &out.OwnerID, &roomType, &taskID, &lang,
		&out.IsFrozen, &vis, &out.ExpiresAt, &out.CreatedAt, &out.IsGuestCreated,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.Room{}, ErrNotFound
		}
		return model.Room{}, fmt.Errorf("UpdateFreeze: %w", err)
	}
	out.Type = model.RoomType(roomType)
	out.Language = model.Language(lang)
	out.Visibility = model.Visibility(vis)
	out.TaskID = taskID
	return out, nil
}

func (r *Repository) AddParticipant(ctx context.Context, p model.Participant) (model.Participant, error) {
	const q = `
INSERT INTO code_room_participants (room_id, user_id, role)
VALUES ($1, $2, $3)
ON CONFLICT (room_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()
RETURNING room_id, user_id, role, joined_at`

	var out model.Participant
	var role string
	err := r.pg.QueryRow(ctx, q, p.RoomID, p.UserID, p.Role.String()).Scan(
		&out.RoomID, &out.UserID, &role, &out.JoinedAt,
	)
	if err != nil {
		return model.Participant{}, fmt.Errorf("AddParticipant: %w", err)
	}
	out.Role = model.Role(role)
	return out, nil
}

func (r *Repository) ListParticipants(ctx context.Context, roomID uuid.UUID) ([]model.Participant, error) {
	const q = `
SELECT room_id, user_id, role, joined_at
FROM code_room_participants
WHERE room_id = $1
ORDER BY joined_at`

	rows, err := r.pg.Query(ctx, q, roomID)
	if err != nil {
		return nil, fmt.Errorf("ListParticipants: %w", err)
	}
	defer rows.Close()

	var out []model.Participant
	for rows.Next() {
		var p model.Participant
		var role string
		if err := rows.Scan(&p.RoomID, &p.UserID, &role, &p.JoinedAt); err != nil {
			return nil, fmt.Errorf("ListParticipants scan: %w", err)
		}
		p.Role = model.Role(role)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) GetRole(ctx context.Context, roomID, userID uuid.UUID) (model.Role, error) {
	const q = `SELECT role FROM code_room_participants WHERE room_id = $1 AND user_id = $2`
	var role string
	err := r.pg.QueryRow(ctx, q, roomID, userID).Scan(&role)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("GetRole: %w", err)
	}
	return model.Role(role), nil
}

func (r *Repository) CountActiveByOwner(ctx context.Context, ownerID uuid.UUID) (int, error) {
	const q = `
SELECT COUNT(*)
FROM code_rooms
WHERE owner_id = $1 AND archived_at IS NULL AND expires_at > now()`
	var n int
	if err := r.pg.QueryRow(ctx, q, ownerID).Scan(&n); err != nil {
		return 0, fmt.Errorf("CountActiveByOwner: %w", err)
	}
	return n, nil
}

// IsExpired reports whether the room TTL has passed.
func IsExpired(room model.Room, now time.Time) bool {
	return !room.ExpiresAt.IsZero() && now.After(room.ExpiresAt)
}

func (r *Repository) ListActiveByOwner(ctx context.Context, ownerID uuid.UUID) ([]model.Room, error) {
	const q = `
SELECT id, owner_id, room_type, task_id, language, is_frozen, visibility, expires_at, created_at, is_guest_created
FROM code_rooms
WHERE owner_id = $1 AND archived_at IS NULL AND expires_at > now()
ORDER BY created_at DESC`

	rows, err := r.pg.Query(ctx, q, ownerID)
	if err != nil {
		return nil, fmt.Errorf("ListActiveByOwner: %w", err)
	}
	defer rows.Close()

	var out []model.Room
	for rows.Next() {
		var room model.Room
		var roomType, lang, vis string
		var taskID *uuid.UUID
		if err := rows.Scan(
			&room.ID, &room.OwnerID, &roomType, &taskID, &lang,
			&room.IsFrozen, &vis, &room.ExpiresAt, &room.CreatedAt, &room.IsGuestCreated,
		); err != nil {
			return nil, fmt.Errorf("ListActiveByOwner scan: %w", err)
		}
		room.Type = model.RoomType(roomType)
		room.Language = model.Language(lang)
		room.Visibility = model.Visibility(vis)
		room.TaskID = taskID
		out = append(out, room)
	}
	return out, rows.Err()
}

func (r *Repository) ArchiveExpired(ctx context.Context) (int64, error) {
	const q = `
UPDATE code_rooms
SET archived_at = now(), updated_at = now()
WHERE archived_at IS NULL AND expires_at <= now()`
	tag, err := r.pg.Exec(ctx, q)
	if err != nil {
		return 0, fmt.Errorf("ArchiveExpired: %w", err)
	}
	return tag.RowsAffected(), nil
}
