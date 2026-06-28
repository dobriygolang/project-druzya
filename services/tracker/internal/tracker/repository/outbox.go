package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
)

const outboxLockDuration = 5 * time.Minute

func (r *Repository) InsertOutbox(ctx context.Context, eventName string, payload map[string]any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal outbox payload: %w", err)
	}
	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO domain_outbox (event_name, payload, status, created_at)
		VALUES ($1, $2, 'pending', now())
	`, eventName, raw)
	return err
}

func (r *Repository) ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]model.OutboxMessage, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := r.conn(ctx).Query(ctx, `
		WITH picked AS (
			SELECT id FROM domain_outbox
			WHERE status IN ('pending', 'failed')
			  AND ($1 = '*' OR event_name = $1)
			  AND (locked_until IS NULL OR locked_until <= now())
			ORDER BY created_at
			LIMIT $2
			FOR UPDATE SKIP LOCKED
		)
		UPDATE domain_outbox o
		SET status = 'processing', locked_until = now() + $3::interval
		FROM picked WHERE o.id = picked.id
		RETURNING o.id, o.event_name, o.payload, o.status, o.locked_until, o.retry_count, o.last_error, o.created_at, o.processed_at
	`, eventName, limit, fmt.Sprintf("%f seconds", outboxLockDuration.Seconds()))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []model.OutboxMessage
	for rows.Next() {
		item, err := scanOutbox(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (r *Repository) AckOutboxEvents(ctx context.Context, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE domain_outbox SET status = 'published', processed_at = now(), locked_until = NULL
		WHERE id = ANY($1) AND status = 'processing'
	`, ids)
	return err
}

func (r *Repository) FailOutboxEvent(ctx context.Context, id, errMsg string, retryDelay time.Duration) error {
	_, err := r.conn(ctx).Exec(ctx, `
		UPDATE domain_outbox
		SET retry_count = retry_count + 1, last_error = $2,
		    status = CASE WHEN retry_count + 1 >= 10 THEN 'failed' ELSE 'pending' END,
		    locked_until = now() + $3::interval
		WHERE id = $1 AND status = 'processing'
	`, id, errMsg, fmt.Sprintf("%f seconds", retryDelay.Seconds()))
	return err
}

func scanOutbox(row pgx.Row) (*model.OutboxMessage, error) {
	var m model.OutboxMessage
	var payload []byte
	if err := row.Scan(&m.ID, &m.EventName, &payload, &m.Status, &m.LockedUntil, &m.RetryCount, &m.LastError, &m.CreatedAt, &m.ProcessedAt); err != nil {
		return nil, err
	}
	if len(payload) > 0 {
		_ = json.Unmarshal(payload, &m.Payload)
	}
	if m.Payload == nil {
		m.Payload = map[string]any{}
	}
	return &m, nil
}
