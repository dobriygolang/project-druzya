package repository

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// ErrNotFound is returned when a requested entity does not exist.
var ErrNotFound = errors.New("not found")

// ErrAlreadyExists is returned when an insert violates a unique constraint
// (e.g. concurrent first login for the same telegram_id / yandex_id).
var ErrAlreadyExists = errors.New("already exists")

// uniqueViolation reports whether err is a Postgres unique_violation (23505).
func uniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
