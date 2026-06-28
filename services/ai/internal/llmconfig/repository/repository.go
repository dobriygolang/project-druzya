package repository

import (
	"context"
	"errors"
	"fmt"

	evaluationrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/repository"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig"
	"github.com/jackc/pgx/v5"
)

// ErrVersionConflict is returned when expected version does not match.
var ErrVersionConflict = errors.New("llm config version conflict")

// Repository stores llm runtime config in Postgres.
type Repository struct {
	pg *evaluationrepo.Pool
}

// New constructs an llm config repository.
func New(pg *evaluationrepo.Pool) *Repository {
	return &Repository{pg: pg}
}

// Load reads the current runtime config snapshot.
func (r *Repository) Load(ctx context.Context) (*llmchain.RuntimeConfig, error) {
	var version int64
	var raw []byte
	err := r.pg.QueryRow(ctx, `
		SELECT version, config
		FROM llm_runtime_config
		WHERE id = 1
	`).Scan(&version, &raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &llmchain.RuntimeConfig{}, nil
		}
		return nil, fmt.Errorf("load llm config: %w", err)
	}
	return llmconfig.DecodeStored(version, raw)
}

// Save persists runtime config with optimistic locking.
func (r *Repository) Save(ctx context.Context, cfg *llmchain.RuntimeConfig, expectedVersion int64) error {
	raw, err := llmconfig.EncodeStored(cfg)
	if err != nil {
		return err
	}
	tag, err := r.pg.Exec(ctx, `
		UPDATE llm_runtime_config
		SET config = $2, version = version + 1, updated_at = now()
		WHERE id = 1 AND version = $1
	`, expectedVersion, raw)
	if err != nil {
		return fmt.Errorf("save llm config: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrVersionConflict
	}
	return nil
}

var _ llmchain.ConfigSource = (*Repository)(nil)
