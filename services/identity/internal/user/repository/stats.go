package repository

import "context"

// UserStats aggregates user registry metrics for ops dashboards.
type UserStats struct {
	TotalUsers    int64
	NewUsers24h   int64
	NewUsers7d    int64
	NewUsers30d   int64
	ActiveUsers7d int64
}

// GetUserStats returns user counts and recent signup/activity windows.
func (r *Repository) GetUserStats(ctx context.Context) (*UserStats, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT
			COUNT(*)::bigint,
			COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::bigint,
			COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')::bigint,
			COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')::bigint,
			COUNT(*) FILTER (WHERE updated_at >= now() - interval '7 days')::bigint
		FROM users
	`)
	out := &UserStats{}
	if err := row.Scan(
		&out.TotalUsers,
		&out.NewUsers24h,
		&out.NewUsers7d,
		&out.NewUsers30d,
		&out.ActiveUsers7d,
	); err != nil {
		return nil, err
	}
	return out, nil
}
