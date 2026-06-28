package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

func (s *recommendationService) MarkArticleRead(ctx context.Context, userID, slug string) (*model.ArticleRead, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, fmt.Errorf("slug is required: %w", ErrInvalidInput)
	}
	if err := s.repo.EnsureUserProfile(ctx, userID); err != nil {
		return nil, fmt.Errorf("ensure user profile: %w", err)
	}
	read, err := s.repo.UpsertArticleRead(ctx, userID, slug)
	if err != nil {
		return nil, fmt.Errorf("upsert article read: %w", err)
	}
	return read, nil
}

func indexReadSlugs(slugs []string) map[string]struct{} {
	out := make(map[string]struct{}, len(slugs))
	for _, slug := range slugs {
		if slug == "" {
			continue
		}
		out[slug] = struct{}{}
	}
	return out
}
