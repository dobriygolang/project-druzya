package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

func (r *Repository) GetUserSettings(ctx context.Context, userID string) (*model.UserSettings, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT user_id, smart_parse_enabled, google_calendar_sync_enabled,
		       google_refresh_token, google_oauth_state, created_at, updated_at
		FROM user_settings WHERE user_id = $1
	`, uid)
	s, err := scanUserSettings(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return &model.UserSettings{UserID: userID}, nil
	}
	return s, err
}

func (r *Repository) UpsertUserSettings(ctx context.Context, userID string, smartParse, googleSync *bool) (*model.UserSettings, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	current, err := r.GetUserSettings(ctx, userID)
	if err != nil {
		return nil, err
	}
	smart := current.SmartParseEnabled
	if smartParse != nil {
		smart = *smartParse
	}
	gSync := current.GoogleCalendarSyncEnabled
	if googleSync != nil {
		gSync = *googleSync
	}
	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO user_settings (user_id, smart_parse_enabled, google_calendar_sync_enabled)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			smart_parse_enabled = EXCLUDED.smart_parse_enabled,
			google_calendar_sync_enabled = EXCLUDED.google_calendar_sync_enabled,
			updated_at = now()
		RETURNING user_id, smart_parse_enabled, google_calendar_sync_enabled,
		          google_refresh_token, google_oauth_state, created_at, updated_at
	`, uid, smart, gSync)
	return scanUserSettings(row)
}

func (r *Repository) SaveGoogleOAuthState(ctx context.Context, userID, state string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO user_settings (user_id, google_oauth_state)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET google_oauth_state = $2, updated_at = now()
	`, uid, state)
	return err
}

func (r *Repository) ConsumeGoogleOAuthState(ctx context.Context, state string) (string, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		UPDATE user_settings SET google_oauth_state = NULL, updated_at = now()
		WHERE google_oauth_state = $1
		RETURNING user_id
	`, state)
	var uid uuid.UUID
	if err := row.Scan(&uid); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	return uid.String(), nil
}

func (r *Repository) SaveGoogleRefreshToken(ctx context.Context, userID, refreshToken string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO user_settings (user_id, google_refresh_token)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET google_refresh_token = $2, updated_at = now()
	`, uid, refreshToken)
	return err
}

func (r *Repository) ClearGoogleRefreshToken(ctx context.Context, userID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	_, err = r.conn(ctx).Exec(ctx, `
		UPDATE user_settings SET google_refresh_token = NULL, updated_at = now()
		WHERE user_id = $1
	`, uid)
	return err
}

func (r *Repository) PatchTaskMetadata(ctx context.Context, taskID, userID string, patch map[string]any) (*model.Task, error) {
	if len(patch) == 0 {
		return r.GetTask(ctx, taskID, userID)
	}
	meta, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}
	tid, err := uuid.Parse(taskID)
	if err != nil {
		return nil, fmt.Errorf("invalid task_id: %w", err)
	}
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		UPDATE tasks t SET metadata = t.metadata || $3::jsonb, updated_at = now()
		FROM sprints s, projects p
		WHERE t.id = $1 AND t.sprint_id = s.id AND s.project_id = p.id AND p.user_id = $2
		RETURNING t.id, t.sprint_id, t.epic_id, t.title, t.done, t.position, t.source, t.metadata, t.dedup_key, t.created_at, t.updated_at, t.completed_at
	`, tid, uid, meta)
	task, err := scanTask(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	return task, err
}

func scanUserSettings(row pgx.Row) (*model.UserSettings, error) {
	var s model.UserSettings
	var uid uuid.UUID
	if err := row.Scan(&uid, &s.SmartParseEnabled, &s.GoogleCalendarSyncEnabled,
		&s.GoogleRefreshToken, &s.GoogleOAuthState, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, err
	}
	s.UserID = uid.String()
	return &s, nil
}
