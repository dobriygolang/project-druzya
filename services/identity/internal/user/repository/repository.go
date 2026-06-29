package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/user/model"
)

const userColumns = `id, username, telegram_id, yandex_id, avatar_url, timezone, created_at, updated_at`

// Repository stores users in PostgreSQL.
type Repository struct {
	pg *Pool
}

// New constructs a postgres-backed user repository.
func New(pg *Pool) *Repository {
	return &Repository{pg: pg}
}

func (r *Repository) GetByID(ctx context.Context, id string) (*model.User, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT `+userColumns+`
		FROM users
		WHERE id = $1
	`, id)
	return scanUser(row)
}

func (r *Repository) GetByTelegramID(ctx context.Context, telegramID int64) (*model.User, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT `+userColumns+`
		FROM users
		WHERE telegram_id = $1
	`, telegramID)
	return scanUser(row)
}

func (r *Repository) GetByYandexID(ctx context.Context, yandexID string) (*model.User, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT `+userColumns+`
		FROM users
		WHERE yandex_id = $1
	`, yandexID)
	return scanUser(row)
}

func (r *Repository) GetByUsername(ctx context.Context, username string) (*model.User, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT `+userColumns+`
		FROM users
		WHERE username = $1
	`, username)
	return scanUser(row)
}

func (r *Repository) Create(ctx context.Context, user *model.User) (*model.User, error) {
	now := time.Now().UTC()
	row := r.pg.QueryRow(ctx, `
		INSERT INTO users (username, telegram_id, yandex_id, avatar_url, timezone, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING `+userColumns,
		user.Username,
		user.TelegramID,
		user.YandexID,
		user.AvatarURL,
		user.Timezone,
		now,
		now,
	)
	created, err := scanUser(row)
	if err != nil {
		if uniqueViolation(err) {
			return nil, ErrAlreadyExists
		}
		return nil, err
	}
	return created, nil
}

func (r *Repository) Update(ctx context.Context, user *model.User) (*model.User, error) {
	row := r.pg.QueryRow(ctx, `
		UPDATE users
		SET username = $2,
		    telegram_id = $3,
		    yandex_id = $4,
		    avatar_url = $5,
		    timezone = $6,
		    updated_at = $7
		WHERE id = $1
		RETURNING `+userColumns,
		user.ID,
		user.Username,
		user.TelegramID,
		user.YandexID,
		user.AvatarURL,
		user.Timezone,
		time.Now().UTC(),
	)
	return scanUser(row)
}

func (r *Repository) UsernameExists(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := r.pg.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)
	`, username).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check username exists: %w", err)
	}
	return exists, nil
}

func scanUser(row pgx.Row) (*model.User, error) {
	var user model.User
	err := row.Scan(
		&user.ID,
		&user.Username,
		&user.TelegramID,
		&user.YandexID,
		&user.AvatarURL,
		&user.Timezone,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan user: %w", err)
	}
	return &user, nil
}
