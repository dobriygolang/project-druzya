package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

// IsEventProcessed checks whether the event was already handled.
func (r *Repository) IsEventProcessed(ctx context.Context, consumer, eventID string) (bool, error) {
	var exists bool
	err := r.conn(ctx).QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM processed_events
			WHERE consumer = $1 AND event_id = $2
		)
	`, consumer, eventID).Scan(&exists)
	return exists, err
}

// MarkEventProcessed records successful event handling.
func (r *Repository) MarkEventProcessed(ctx context.Context, consumer, eventID string) error {
	id, err := uuid.NewRandom()
	if err != nil {
		return err
	}
	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO processed_events (id, consumer, event_id)
		VALUES ($1, $2, $3)
		ON CONFLICT (consumer, event_id) DO NOTHING
	`, id, consumer, eventID)
	return err
}

// EnsureUserProfile creates a profile row when missing.
func (r *Repository) EnsureUserProfile(ctx context.Context, userID string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	id, err := uuid.NewRandom()
	if err != nil {
		return err
	}
	_, err = r.conn(ctx).Exec(ctx, `
		INSERT INTO user_skill_profiles (id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO NOTHING
	`, id, uid)
	return err
}

// GetSkillScore loads a skill score row.
func (r *Repository) GetSkillScore(ctx context.Context, userID, skillKey string) (*model.SkillScore, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, skill_key, score, confidence, attempts_count, last_seen_at, created_at, updated_at
		FROM skill_scores
		WHERE user_id = $1 AND skill_key = $2
	`, uid, skillKey)

	var s model.SkillScore
	var id, rowUserID uuid.UUID
	if err := row.Scan(&id, &rowUserID, &s.SkillKey, &s.Score, &s.Confidence, &s.AttemptsCount, &s.LastSeenAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	s.ID = id.String()
	s.UserID = rowUserID.String()
	return &s, nil
}

// UpsertSkillScore inserts or updates a skill score with moving average.
func (r *Repository) UpsertSkillScore(ctx context.Context, userID, skillKey string, normalized int, seenAt time.Time) (*model.SkillScore, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}

	existing, err := r.GetSkillScore(ctx, userID, skillKey)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return nil, err
	}

	var score, confidence, attempts int
	if existing != nil {
		attempts = existing.AttemptsCount + 1
		score = (existing.Score*existing.AttemptsCount + normalized) / attempts
		confidence = min(100, attempts*10)
	} else {
		attempts = 1
		score = normalized
		confidence = min(100, attempts*10)
	}

	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO skill_scores (id, user_id, skill_key, score, confidence, attempts_count, last_seen_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, skill_key) DO UPDATE SET
			score = EXCLUDED.score,
			confidence = EXCLUDED.confidence,
			attempts_count = EXCLUDED.attempts_count,
			last_seen_at = EXCLUDED.last_seen_at,
			updated_at = now()
		RETURNING id, user_id, skill_key, score, confidence, attempts_count, last_seen_at, created_at, updated_at
	`, id, uid, skillKey, score, confidence, attempts, seenAt)

	var s model.SkillScore
	var rowID, rowUserID uuid.UUID
	if err := row.Scan(&rowID, &rowUserID, &s.SkillKey, &s.Score, &s.Confidence, &s.AttemptsCount, &s.LastSeenAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return nil, err
	}
	s.ID = rowID.String()
	s.UserID = rowUserID.String()
	return &s, nil
}

// ListSkillScoresByUser returns all skill scores for a user.
func (r *Repository) ListSkillScoresByUser(ctx context.Context, userID string) ([]model.SkillScore, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, user_id, skill_key, score, confidence, attempts_count, last_seen_at, created_at, updated_at
		FROM skill_scores
		WHERE user_id = $1
		ORDER BY skill_key
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.SkillScore
	for rows.Next() {
		var s model.SkillScore
		var id, rowUserID uuid.UUID
		if err := rows.Scan(&id, &rowUserID, &s.SkillKey, &s.Score, &s.Confidence, &s.AttemptsCount, &s.LastSeenAt, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		s.ID = id.String()
		s.UserID = rowUserID.String()
		out = append(out, s)
	}
	return out, rows.Err()
}

// UpdateReadinessScore recalculates and stores readiness for a user.
func (r *Repository) UpdateReadinessScore(ctx context.Context, userID string, readiness int) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	_, err = r.conn(ctx).Exec(ctx, `
		UPDATE user_skill_profiles
		SET readiness_score = $2, updated_at = now()
		WHERE user_id = $1
	`, uid, readiness)
	return err
}

// GetUserProfile returns the user skill profile.
func (r *Repository) GetUserProfile(ctx context.Context, userID string) (*model.UserSkillProfile, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, readiness_score, profile_summary, summary_updated_at, created_at, updated_at
		FROM user_skill_profiles
		WHERE user_id = $1
	`, uid)

	var p model.UserSkillProfile
	var id, rowUserID uuid.UUID
	if err := row.Scan(&id, &rowUserID, &p.ReadinessScore, &p.ProfileSummary, &p.SummaryUpdatedAt, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	p.ID = id.String()
	p.UserID = rowUserID.String()
	return &p, nil
}

// UpdateProfileSummary stores generated profile summary text.
func (r *Repository) UpdateProfileSummary(ctx context.Context, userID, summary string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	_, err = r.conn(ctx).Exec(ctx, `
		UPDATE user_skill_profiles
		SET profile_summary = $2, summary_updated_at = now(), updated_at = now()
		WHERE user_id = $1
	`, uid, summary)
	return err
}

// UpsertImproveSkillRecommendation creates or updates an active improve_skill recommendation.
func (r *Repository) UpsertImproveSkillRecommendation(ctx context.Context, rec model.Recommendation) (*model.Recommendation, error) {
	return r.upsertActiveRecommendation(ctx, rec)
}

// InsertSpecialRecommendation inserts rewrite_answer or practice_section when no active duplicate exists.
func (r *Repository) InsertSpecialRecommendation(ctx context.Context, rec model.Recommendation) (*model.Recommendation, error) {
	uid, err := uuid.Parse(rec.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	meta, err := json.Marshal(rec.Metadata)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		meta = []byte("{}")
	}

	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO recommendations (id, user_id, type, priority, skill_key, title, description, status, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, type, skill_key) WHERE status = 'active' AND type IN ('rewrite_answer', 'practice_section')
		DO NOTHING
		RETURNING id, user_id, type, priority, skill_key, title, description, status, metadata, created_at, updated_at, dismissed_at, completed_at
	`, id, uid, rec.Type, rec.Priority, rec.SkillKey, rec.Title, rec.Description, model.RecStatusActive, meta)

	planRec, err := scanRecommendation(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return planRec, nil
}

func (r *Repository) upsertActiveRecommendation(ctx context.Context, rec model.Recommendation) (*model.Recommendation, error) {
	uid, err := uuid.Parse(rec.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	meta, err := json.Marshal(rec.Metadata)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		meta = []byte("{}")
	}

	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO recommendations (id, user_id, type, priority, skill_key, title, description, status, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, type, skill_key) WHERE status = 'active' AND type = 'improve_skill'
		DO UPDATE SET
			priority = EXCLUDED.priority,
			title = EXCLUDED.title,
			description = EXCLUDED.description,
			metadata = EXCLUDED.metadata,
			updated_at = now()
		RETURNING id, user_id, type, priority, skill_key, title, description, status, metadata, created_at, updated_at, dismissed_at, completed_at
	`, id, uid, rec.Type, rec.Priority, rec.SkillKey, rec.Title, rec.Description, model.RecStatusActive, meta)

	return scanRecommendation(row)
}

// CreateRetryTaskPlanItem inserts a retry learning plan item when not duplicate.
func (r *Repository) CreateRetryTaskPlanItem(ctx context.Context, item model.LearningPlanItem) (*model.LearningPlanItem, error) {
	uid, err := uuid.Parse(item.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	meta, err := json.Marshal(item.Metadata)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		meta = []byte("{}")
	}

	var taskID *uuid.UUID
	if item.TaskID != nil && *item.TaskID != "" {
		parsed, parseErr := uuid.Parse(*item.TaskID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid task_id: %w", parseErr)
		}
		taskID = &parsed
	}

	var recID *uuid.UUID
	if item.RecommendationID != nil && *item.RecommendationID != "" {
		parsed, parseErr := uuid.Parse(*item.RecommendationID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid recommendation_id: %w", parseErr)
		}
		recID = &parsed
	}

	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO learning_plan_items (id, user_id, recommendation_id, type, task_id, skill_key, title, description, status, position, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (user_id, type, (metadata ->> 'task_id'))
			WHERE status IN ('pending', 'in_progress') AND type = 'retry_task'
		DO NOTHING
		RETURNING id, user_id, recommendation_id, type, task_id, skill_key, title, description, status, position, metadata, created_at, updated_at, completed_at
	`, id, uid, recID, item.Type, taskID, item.SkillKey, item.Title, item.Description, item.Status, item.Position, meta)

	planItem, err := scanLearningPlanItem(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return planItem, nil
}

// ListActiveRecommendations returns active recommendations for a user.
func (r *Repository) ListActiveRecommendations(ctx context.Context, userID string) ([]model.Recommendation, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, user_id, type, priority, skill_key, title, description, status, metadata, created_at, updated_at, dismissed_at, completed_at
		FROM recommendations
		WHERE user_id = $1 AND status = 'active'
		ORDER BY
			CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
			created_at DESC
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.Recommendation
	for rows.Next() {
		rec, scanErr := scanRecommendationRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		out = append(out, *rec)
	}
	return out, rows.Err()
}

// ListActiveLearningPlanItems returns pending/in_progress plan items.
func (r *Repository) ListActiveLearningPlanItems(ctx context.Context, userID string) ([]model.LearningPlanItem, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, user_id, recommendation_id, type, task_id, skill_key, title, description, status, position, metadata, created_at, updated_at, completed_at
		FROM learning_plan_items
		WHERE user_id = $1 AND status IN ('pending', 'in_progress')
		ORDER BY position, created_at
	`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []model.LearningPlanItem
	for rows.Next() {
		item, scanErr := scanLearningPlanItemRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		out = append(out, *item)
	}
	return out, rows.Err()
}

// GetRecommendation loads a recommendation by id scoped to user.
func (r *Repository) GetRecommendation(ctx context.Context, userID, id string) (*model.Recommendation, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	rid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, type, priority, skill_key, title, description, status, metadata, created_at, updated_at, dismissed_at, completed_at
		FROM recommendations
		WHERE id = $1 AND user_id = $2
	`, rid, uid)
	return scanRecommendation(row)
}

// UpdateRecommendationStatus updates recommendation status.
func (r *Repository) UpdateRecommendationStatus(ctx context.Context, userID, id, status string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	rid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("invalid id: %w", err)
	}

	var dismissedAt, completedAt *time.Time
	now := time.Now().UTC()
	switch status {
	case model.RecStatusDismissed:
		dismissedAt = &now
	case model.RecStatusCompleted:
		completedAt = &now
	}

	tag, err := r.conn(ctx).Exec(ctx, `
		UPDATE recommendations
		SET status = $3, dismissed_at = COALESCE($4, dismissed_at), completed_at = COALESCE($5, completed_at), updated_at = now()
		WHERE id = $1 AND user_id = $2 AND status = 'active'
	`, rid, uid, status, dismissedAt, completedAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetLearningPlanItem loads a plan item by id scoped to user.
func (r *Repository) GetLearningPlanItem(ctx context.Context, userID, id string) (*model.LearningPlanItem, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	pid, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("invalid id: %w", err)
	}
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT id, user_id, recommendation_id, type, task_id, skill_key, title, description, status, position, metadata, created_at, updated_at, completed_at
		FROM learning_plan_items
		WHERE id = $1 AND user_id = $2
	`, pid, uid)
	return scanLearningPlanItem(row)
}

// UpdateLearningPlanItemStatus updates plan item status.
func (r *Repository) UpdateLearningPlanItemStatus(ctx context.Context, userID, id, status string) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user_id: %w", err)
	}
	pid, err := uuid.Parse(id)
	if err != nil {
		return fmt.Errorf("invalid id: %w", err)
	}

	var completedAt *time.Time
	if status == model.PlanStatusCompleted {
		now := time.Now().UTC()
		completedAt = &now
	}

	tag, err := r.conn(ctx).Exec(ctx, `
		UPDATE learning_plan_items
		SET status = $3, completed_at = COALESCE($4, completed_at), updated_at = now()
		WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'in_progress')
	`, pid, uid, status, completedAt)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func scanRecommendation(row pgx.Row) (*model.Recommendation, error) {
	var rec model.Recommendation
	var id, userID uuid.UUID
	var meta []byte
	if err := row.Scan(&id, &userID, &rec.Type, &rec.Priority, &rec.SkillKey, &rec.Title, &rec.Description, &rec.Status, &meta, &rec.CreatedAt, &rec.UpdatedAt, &rec.DismissedAt, &rec.CompletedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	rec.ID = id.String()
	rec.UserID = userID.String()
	if len(meta) > 0 {
		_ = json.Unmarshal(meta, &rec.Metadata)
	}
	if rec.Metadata == nil {
		rec.Metadata = map[string]any{}
	}
	return &rec, nil
}

func scanRecommendationRow(rows pgx.Rows) (*model.Recommendation, error) {
	var rec model.Recommendation
	var id, userID uuid.UUID
	var meta []byte
	if err := rows.Scan(&id, &userID, &rec.Type, &rec.Priority, &rec.SkillKey, &rec.Title, &rec.Description, &rec.Status, &meta, &rec.CreatedAt, &rec.UpdatedAt, &rec.DismissedAt, &rec.CompletedAt); err != nil {
		return nil, err
	}
	rec.ID = id.String()
	rec.UserID = userID.String()
	if len(meta) > 0 {
		_ = json.Unmarshal(meta, &rec.Metadata)
	}
	if rec.Metadata == nil {
		rec.Metadata = map[string]any{}
	}
	return &rec, nil
}

func scanLearningPlanItem(row pgx.Row) (*model.LearningPlanItem, error) {
	var item model.LearningPlanItem
	var id, userID uuid.UUID
	var recID, taskID *uuid.UUID
	var meta []byte
	if err := row.Scan(&id, &userID, &recID, &item.Type, &taskID, &item.SkillKey, &item.Title, &item.Description, &item.Status, &item.Position, &meta, &item.CreatedAt, &item.UpdatedAt, &item.CompletedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	item.ID = id.String()
	item.UserID = userID.String()
	if recID != nil {
		s := recID.String()
		item.RecommendationID = &s
	}
	if taskID != nil {
		s := taskID.String()
		item.TaskID = &s
	}
	if len(meta) > 0 {
		_ = json.Unmarshal(meta, &item.Metadata)
	}
	if item.Metadata == nil {
		item.Metadata = map[string]any{}
	}
	return &item, nil
}

func scanLearningPlanItemRow(rows pgx.Rows) (*model.LearningPlanItem, error) {
	var item model.LearningPlanItem
	var id, userID uuid.UUID
	var recID, taskID *uuid.UUID
	var meta []byte
	if err := rows.Scan(&id, &userID, &recID, &item.Type, &taskID, &item.SkillKey, &item.Title, &item.Description, &item.Status, &item.Position, &meta, &item.CreatedAt, &item.UpdatedAt, &item.CompletedAt); err != nil {
		return nil, err
	}
	item.ID = id.String()
	item.UserID = userID.String()
	if recID != nil {
		s := recID.String()
		item.RecommendationID = &s
	}
	if taskID != nil {
		s := taskID.String()
		item.TaskID = &s
	}
	if len(meta) > 0 {
		_ = json.Unmarshal(meta, &item.Metadata)
	}
	if item.Metadata == nil {
		item.Metadata = map[string]any{}
	}
	return &item, nil
}

// FetchDashboardSnapshot loads profile, skills, recommendations, and plan in one repository call.
func (r *Repository) FetchDashboardSnapshot(ctx context.Context, userID string) (*model.DashboardSnapshot, error) {
	if err := r.EnsureUserProfile(ctx, userID); err != nil {
		return nil, err
	}
	profile, err := r.GetUserProfile(ctx, userID)
	if err != nil {
		return nil, err
	}
	scores, err := r.ListSkillScoresByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	recs, err := r.ListActiveRecommendations(ctx, userID)
	if err != nil {
		return nil, err
	}
	plan, err := r.ListActiveLearningPlanItems(ctx, userID)
	if err != nil {
		return nil, err
	}
	return &model.DashboardSnapshot{
		Profile:         profile,
		SkillScores:     scores,
		Recommendations: recs,
		LearningPlan:    plan,
	}, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// InsertTakeMockRecommendation creates an active mock interview recommendation when none exists.
func (r *Repository) InsertTakeMockRecommendation(ctx context.Context, rec model.Recommendation) (*model.Recommendation, error) {
	uid, err := uuid.Parse(rec.UserID)
	if err != nil {
		return nil, fmt.Errorf("invalid user_id: %w", err)
	}
	meta, err := json.Marshal(rec.Metadata)
	if err != nil {
		return nil, err
	}
	if meta == nil {
		meta = []byte("{}")
	}

	id, err := uuid.NewRandom()
	if err != nil {
		return nil, err
	}

	row := r.conn(ctx).QueryRow(ctx, `
		INSERT INTO recommendations (id, user_id, type, priority, skill_key, title, description, status, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (user_id, type) WHERE status = 'active' AND type = 'take_mock_interview'
		DO NOTHING
		RETURNING id, user_id, type, priority, skill_key, title, description, status, metadata, created_at, updated_at, dismissed_at, completed_at
	`, id, uid, rec.Type, rec.Priority, rec.SkillKey, rec.Title, rec.Description, model.RecStatusActive, meta)

	planRec, err := scanRecommendation(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return planRec, nil
}

// NextLearningPlanPosition returns the next position for a user's plan queue.
func (r *Repository) NextLearningPlanPosition(ctx context.Context, userID string) (int, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return 0, fmt.Errorf("invalid user_id: %w", err)
	}
	var maxPos *int
	err = r.conn(ctx).QueryRow(ctx, `
		SELECT MAX(position) FROM learning_plan_items WHERE user_id = $1
	`, uid).Scan(&maxPos)
	if err != nil {
		return 0, err
	}
	if maxPos == nil {
		return 0, nil
	}
	return *maxPos + 1, nil
}
