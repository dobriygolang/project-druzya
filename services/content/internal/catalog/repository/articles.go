package repository

import (
	"context"
	"errors"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	"github.com/jackc/pgx/v5"
)

// ListArticlesFilter selects catalog articles.
type ListArticlesFilter struct {
	SkillKey    *string
	Query       *string
	Status      *catalogmodel.ArticleStatus
	AllStatuses bool
	Limit       int
	Offset      int
}

func (r *Repository) ListArticles(ctx context.Context, f ListArticlesFilter) ([]catalogmodel.Article, error) {
	var statusFilter *string
	if f.AllStatuses {
		if f.Status != nil {
			v := string(*f.Status)
			statusFilter = &v
		}
	} else {
		status := f.Status
		if status == nil {
			defaultStatus := catalogmodel.ArticleStatusPublished
			status = &defaultStatus
		}
		v := string(*status)
		statusFilter = &v
	}

	rows, err := r.pg.Query(ctx, `
		SELECT a.id, a.slug, a.title, a.summary, a.body, a.status, a.reading_minutes,
		       a.created_at, a.updated_at
		FROM articles a
		WHERE ($1::text IS NULL OR a.status = $1)
		  AND ($2::text IS NULL OR EXISTS (
		        SELECT 1 FROM article_skill_keys ask
		        WHERE ask.article_id = a.id AND ask.skill_key = $2
		      ))
		  AND ($5::text IS NULL OR (
		        a.title ILIKE '%' || $5 || '%'
		        OR a.summary ILIKE '%' || $5 || '%'
		        OR a.slug ILIKE '%' || $5 || '%'
		        OR a.body ILIKE '%' || $5 || '%'
		      ))
		ORDER BY a.updated_at DESC
		LIMIT $3 OFFSET $4
	`, statusFilter, f.SkillKey, f.Limit, f.Offset, searchQuery(f.Query))
	if err != nil {
		return nil, fmt.Errorf("list articles: %w", err)
	}
	defer rows.Close()

	var items []catalogmodel.Article
	for rows.Next() {
		item, err := scanArticle(rows, true)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range items {
		keys, err := r.listArticleSkillKeys(ctx, items[i].ID)
		if err != nil {
			return nil, err
		}
		items[i].SkillKeys = keys
	}
	return items, nil
}

func (r *Repository) ListPublishedArticlesBySkillKeys(ctx context.Context, skillKeys []string) ([]catalogmodel.Article, error) {
	if len(skillKeys) == 0 {
		return nil, nil
	}

	rows, err := r.pg.Query(ctx, `
		SELECT DISTINCT ON (ask.skill_key)
		       a.id, a.slug, a.title, a.summary, '' AS body, a.status, a.reading_minutes,
		       a.created_at, a.updated_at, ask.skill_key
		FROM article_skill_keys ask
		JOIN articles a ON a.id = ask.article_id
		WHERE ask.skill_key = ANY($1)
		  AND a.status = $2
		ORDER BY ask.skill_key, a.updated_at DESC
	`, skillKeys, catalogmodel.ArticleStatusPublished)
	if err != nil {
		return nil, fmt.Errorf("list articles by skill keys: %w", err)
	}
	defer rows.Close()

	type row struct {
		article  catalogmodel.Article
		skillKey string
	}
	var matched []row
	for rows.Next() {
		var item catalogmodel.Article
		var status string
		var skillKey string
		if err := rows.Scan(
			&item.ID, &item.Slug, &item.Title, &item.Summary, &item.Body, &status,
			&item.ReadingMinutes, &item.CreatedAt, &item.UpdatedAt, &skillKey,
		); err != nil {
			return nil, fmt.Errorf("scan article by skill: %w", err)
		}
		parsed, err := catalogmodel.ParseArticleStatus(status)
		if err != nil {
			return nil, err
		}
		item.Status = parsed
		matched = append(matched, row{article: item, skillKey: skillKey})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	byID := make(map[string]*catalogmodel.Article)
	var order []string
	for _, m := range matched {
		existing, ok := byID[m.article.ID]
		if !ok {
			copyItem := m.article
			copyItem.SkillKeys = []string{m.skillKey}
			byID[m.article.ID] = &copyItem
			order = append(order, m.article.ID)
			continue
		}
		existing.SkillKeys = append(existing.SkillKeys, m.skillKey)
	}

	out := make([]catalogmodel.Article, 0, len(order))
	for _, id := range order {
		out = append(out, *byID[id])
	}
	return out, nil
}

func (r *Repository) GetArticleByID(ctx context.Context, id string) (*catalogmodel.Article, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, title, summary, body, status, reading_minutes, created_at, updated_at
		FROM articles WHERE id = $1
	`, id)
	return r.finishArticle(ctx, row)
}

func (r *Repository) GetArticleBySlug(ctx context.Context, slug string) (*catalogmodel.Article, error) {
	row := r.pg.QueryRow(ctx, `
		SELECT id, slug, title, summary, body, status, reading_minutes, created_at, updated_at
		FROM articles WHERE slug = $1
	`, slug)
	return r.finishArticle(ctx, row)
}

func (r *Repository) finishArticle(ctx context.Context, row pgx.Row) (*catalogmodel.Article, error) {
	item, err := scanArticle(row, true)
	if err != nil {
		return nil, err
	}
	keys, err := r.listArticleSkillKeys(ctx, item.ID)
	if err != nil {
		return nil, err
	}
	item.SkillKeys = keys
	videos, err := r.listArticleVideos(ctx, item.ID)
	if err != nil {
		return nil, err
	}
	item.Videos = videos
	tasks, err := r.listArticleTasks(ctx, item.ID)
	if err != nil {
		return nil, err
	}
	item.LinkedTasks = tasks
	return item, nil
}

func searchQuery(q *string) *string {
	if q == nil {
		return nil
	}
	s := sanitizeSearchQuery(*q)
	if s == "" {
		return nil
	}
	return &s
}

func (r *Repository) listArticleSkillKeys(ctx context.Context, articleID string) ([]string, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT skill_key FROM article_skill_keys WHERE article_id = $1 ORDER BY skill_key
	`, articleID)
	if err != nil {
		return nil, fmt.Errorf("list article skill keys: %w", err)
	}
	defer rows.Close()

	var keys []string
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func scanArticle(row pgx.Row, includeBody bool) (*catalogmodel.Article, error) {
	var item catalogmodel.Article
	var status string
	var body string
	if includeBody {
		err := row.Scan(
			&item.ID, &item.Slug, &item.Title, &item.Summary, &body, &status,
			&item.ReadingMinutes, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrNotFound
			}
			return nil, fmt.Errorf("scan article: %w", err)
		}
		item.Body = body
	} else {
		err := row.Scan(
			&item.ID, &item.Slug, &item.Title, &item.Summary, &status,
			&item.ReadingMinutes, &item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrNotFound
			}
			return nil, fmt.Errorf("scan article: %w", err)
		}
	}
	parsed, err := catalogmodel.ParseArticleStatus(status)
	if err != nil {
		return nil, err
	}
	item.Status = parsed
	return &item, nil
}
