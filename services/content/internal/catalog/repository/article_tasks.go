package repository

import (
	"context"
	"fmt"
	"strings"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

func (r *Repository) listArticleTasks(ctx context.Context, articleID string) ([]catalogmodel.ArticleTaskLink, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT t.id, t.slug, t.title, t.type, t.difficulty, at.position
		FROM article_tasks at
		JOIN tasks t ON t.id = at.task_id
		WHERE at.article_id = $1
		ORDER BY at.position ASC
	`, articleID)
	if err != nil {
		return nil, fmt.Errorf("list article tasks: %w", err)
	}
	defer rows.Close()

	var links []catalogmodel.ArticleTaskLink
	for rows.Next() {
		var link catalogmodel.ArticleTaskLink
		if err := rows.Scan(
			&link.TaskID, &link.Slug, &link.Title, &link.Type, &link.Difficulty, &link.Position,
		); err != nil {
			return nil, fmt.Errorf("scan article task: %w", err)
		}
		links = append(links, link)
	}
	return links, rows.Err()
}

func (r *Repository) replaceArticleTasks(ctx context.Context, articleID string, taskIDs []string) error {
	if _, err := r.pg.Exec(ctx, `DELETE FROM article_tasks WHERE article_id = $1`, articleID); err != nil {
		return fmt.Errorf("clear article tasks: %w", err)
	}
	for i, taskID := range taskIDs {
		if taskID == "" {
			continue
		}
		position := i + 1
		if _, err := r.pg.Exec(ctx, `
			INSERT INTO article_tasks (article_id, task_id, position)
			VALUES ($1, $2, $3)
		`, articleID, taskID, position); err != nil {
			return fmt.Errorf("insert article task: %w", err)
		}
	}
	return nil
}

// ListRelatedArticles returns published articles sharing skill keys with the source article.
func (r *Repository) ListRelatedArticles(ctx context.Context, articleID string, skillKeys []string, limit int) ([]catalogmodel.Article, error) {
	if len(skillKeys) == 0 {
		return nil, nil
	}
	if limit <= 0 {
		limit = 4
	}

	rows, err := r.pg.Query(ctx, `
		SELECT DISTINCT a.id, a.slug, a.title, a.summary, '' AS body, a.status, a.reading_minutes,
		       a.created_at, a.updated_at
		FROM articles a
		JOIN article_skill_keys ask ON ask.article_id = a.id
		WHERE ask.skill_key = ANY($1)
		  AND a.id <> $2
		  AND a.status = $3
		ORDER BY a.updated_at DESC
		LIMIT $4
	`, skillKeys, articleID, catalogmodel.ArticleStatusPublished, limit)
	if err != nil {
		return nil, fmt.Errorf("list related articles: %w", err)
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

func sanitizeSearchQuery(q string) string {
	q = strings.TrimSpace(q)
	if q == "" {
		return ""
	}
	q = strings.ReplaceAll(q, "%", "")
	q = strings.ReplaceAll(q, "_", "")
	return q
}
