package repository

import (
	"context"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// UpsertArticle inserts or updates an article and replaces skill key links.
func (r *Repository) UpsertArticle(ctx context.Context, a catalogmodel.Article) (*catalogmodel.Article, error) {
	row := r.pg.QueryRow(ctx, `
		INSERT INTO articles (id, slug, title, summary, body, status, reading_minutes)
		VALUES (
			COALESCE(NULLIF($1, '')::uuid, gen_random_uuid()),
			$2, $3, $4, $5, $6, $7
		)
		ON CONFLICT (slug) DO UPDATE SET
			title = EXCLUDED.title,
			summary = EXCLUDED.summary,
			body = EXCLUDED.body,
			status = EXCLUDED.status,
			reading_minutes = EXCLUDED.reading_minutes,
			updated_at = now()
		RETURNING id, slug, title, summary, body, status, reading_minutes, created_at, updated_at
	`, nullUUID(a.ID), a.Slug, a.Title, a.Summary, a.Body, string(a.Status), a.ReadingMinutes)
	article, err := scanArticle(row, true)
	if err != nil {
		return nil, fmt.Errorf("upsert article: %w", err)
	}

	if _, err := r.pg.Exec(ctx, `DELETE FROM article_skill_keys WHERE article_id = $1`, article.ID); err != nil {
		return nil, fmt.Errorf("clear article skill keys: %w", err)
	}
	for _, skillKey := range a.SkillKeys {
		if skillKey == "" {
			continue
		}
		if _, err := r.pg.Exec(ctx, `
			INSERT INTO article_skill_keys (article_id, skill_key)
			VALUES ($1, $2)
			ON CONFLICT DO NOTHING
		`, article.ID, skillKey); err != nil {
			return nil, fmt.Errorf("insert article skill key: %w", err)
		}
	}
	article.SkillKeys = append([]string(nil), a.SkillKeys...)
	if err := r.replaceArticleVideos(ctx, article.ID, a.Videos); err != nil {
		return nil, err
	}
	videos, err := r.listArticleVideos(ctx, article.ID)
	if err != nil {
		return nil, err
	}
	article.Videos = videos
	if err := r.replaceArticleTasks(ctx, article.ID, a.TaskIDs); err != nil {
		return nil, err
	}
	tasks, err := r.listArticleTasks(ctx, article.ID)
	if err != nil {
		return nil, err
	}
	article.LinkedTasks = tasks
	return article, nil
}
