package repository

import "context"

// CountActiveSubscriptions returns paid/trial subscriptions currently active.
func (r *Repository) CountActiveSubscriptions(ctx context.Context) (int64, error) {
	var count int64
	err := r.conn(ctx).QueryRow(ctx, `
		SELECT COUNT(*)::bigint
		FROM subscriptions
		WHERE status IN ('active', 'trialing')
	`).Scan(&count)
	return count, err
}
