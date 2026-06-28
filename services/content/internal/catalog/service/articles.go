package service

import (
	"context"
	"fmt"
	"strings"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
)

func optionalSearchQuery(raw string) *string {
	q := strings.TrimSpace(raw)
	if q == "" {
		return nil
	}
	return &q
}

func (s *catalogService) ListArticles(ctx context.Context, skillKey, query *string, limit, offset int) ([]catalogmodel.Article, error) {
	return s.repo.ListArticles(ctx, catalogrepo.ListArticlesFilter{
		SkillKey: skillKey,
		Query:    query,
		Limit:    normalizeLimit(limit),
		Offset:   normalizeOffset(offset),
	})
}

func (s *catalogService) ListArticlesAdmin(
	ctx context.Context,
	status *catalogmodel.ArticleStatus,
	allStatuses bool,
	query *string,
	limit, offset int,
) ([]catalogmodel.Article, error) {
	return s.repo.ListArticles(ctx, catalogrepo.ListArticlesFilter{
		Status:      status,
		AllStatuses: allStatuses,
		Query:       query,
		Limit:       normalizeLimit(limit),
		Offset:      normalizeOffset(offset),
	})
}

func (s *catalogService) ListPublishedArticlesBySkillKeys(ctx context.Context, skillKeys []string) ([]catalogmodel.Article, error) {
	return s.repo.ListPublishedArticlesBySkillKeys(ctx, skillKeys)
}

func (s *catalogService) GetArticle(ctx context.Context, id, slug string) (*catalogmodel.Article, error) {
	var (
		article *catalogmodel.Article
		err     error
	)
	switch {
	case id != "":
		article, err = s.repo.GetArticleByID(ctx, id)
	case slug != "":
		article, err = s.repo.GetArticleBySlug(ctx, slug)
	default:
		return nil, ErrInvalidArgument
	}
	if err != nil {
		return nil, err
	}
	return article, nil
}

func (s *catalogService) ListRelatedArticles(ctx context.Context, articleID string, skillKeys []string, limit int) ([]catalogmodel.Article, error) {
	if articleID == "" {
		return nil, ErrInvalidArgument
	}
	return s.repo.ListRelatedArticles(ctx, articleID, skillKeys, limit)
}

func (s *catalogService) ResolveTaskIDs(ctx context.Context, slugs []string) ([]string, error) {
	ids := make([]string, 0, len(slugs))
	for _, slug := range slugs {
		slug = strings.TrimSpace(slug)
		if slug == "" {
			continue
		}
		task, err := s.repo.GetTaskBySlug(ctx, slug)
		if err != nil {
			return nil, fmt.Errorf("task slug %q: %w", slug, err)
		}
		ids = append(ids, task.ID)
	}
	return ids, nil
}
