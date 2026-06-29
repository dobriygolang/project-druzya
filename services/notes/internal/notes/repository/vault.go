package repository

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) InitVault(ctx context.Context, userID string) (string, bool, error) {
	var existing []byte
	err := r.pg.QueryRow(ctx, `SELECT salt FROM vault_salts WHERE user_id = $1`, userID).Scan(&existing)
	if err == nil {
		return base64.StdEncoding.EncodeToString(existing), true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", false, err
	}

	salt := make([]byte, 32)
	if _, err := rand.Read(salt); err != nil {
		return "", false, err
	}
	_, err = r.pg.Exec(ctx, `INSERT INTO vault_salts (user_id, salt) VALUES ($1, $2)`, userID, salt)
	if err != nil {
		return "", false, err
	}
	return base64.StdEncoding.EncodeToString(salt), false, nil
}

func (r *Repository) GetVaultSalt(ctx context.Context, userID string) (string, bool, error) {
	var salt []byte
	err := r.pg.QueryRow(ctx, `SELECT salt FROM vault_salts WHERE user_id = $1`, userID).Scan(&salt)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return base64.StdEncoding.EncodeToString(salt), true, nil
}
