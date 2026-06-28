package repository

import (
	"context"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

func (r *Repository) listArticleVideos(ctx context.Context, articleID string) ([]catalogmodel.ArticleVideo, error) {
	rows, err := r.pg.Query(ctx, `
		SELECT id, article_id, title, url, provider, position, duration_seconds
		FROM article_videos
		WHERE article_id = $1
		ORDER BY position ASC
	`, articleID)
	if err != nil {
		return nil, fmt.Errorf("list article videos: %w", err)
	}
	defer rows.Close()

	var videos []catalogmodel.ArticleVideo
	for rows.Next() {
		var v catalogmodel.ArticleVideo
		var provider string
		if err := rows.Scan(
			&v.ID, &v.ArticleID, &v.Title, &v.URL, &provider, &v.Position, &v.DurationSeconds,
		); err != nil {
			return nil, fmt.Errorf("scan article video: %w", err)
		}
		parsed, err := catalogmodel.ParseArticleVideoProvider(provider)
		if err != nil {
			return nil, err
		}
		v.Provider = parsed
		videos = append(videos, v)
	}
	return videos, rows.Err()
}

func (r *Repository) replaceArticleVideos(ctx context.Context, articleID string, videos []catalogmodel.ArticleVideo) error {
	if _, err := r.pg.Exec(ctx, `DELETE FROM article_videos WHERE article_id = $1`, articleID); err != nil {
		return fmt.Errorf("clear article videos: %w", err)
	}
	for i, v := range videos {
		if v.Title == "" || v.URL == "" {
			continue
		}
		position := v.Position
		if position <= 0 {
			position = i + 1
		}
		provider := v.Provider
		if provider == "" {
			provider = catalogmodel.ArticleVideoProviderYouTube
		}
		if _, err := catalogmodel.ParseArticleVideoProvider(string(provider)); err != nil {
			return err
		}
		if _, err := r.pg.Exec(ctx, `
			INSERT INTO article_videos (article_id, title, url, provider, position, duration_seconds)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, articleID, v.Title, v.URL, string(provider), position, v.DurationSeconds); err != nil {
			return fmt.Errorf("insert article video: %w", err)
		}
	}
	return nil
}
