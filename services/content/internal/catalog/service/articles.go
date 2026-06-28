package service

import (
	"context"
	"fmt"
	"strings"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
)

func (s *catalogService) ListArticles(ctx context.Context, skillKey, query *string, limit, offset int) ([]catalogmodel.Article, error) {
	f := catalogrepo.ListArticlesFilter{
		SkillKey: skillKey,
		Query:    query,
		Limit:    normalizeLimit(limit),
		Offset:   normalizeOffset(offset),
	}
	if snap := s.snapshot(); snap != nil {
		s.cacheHit()
		return snap.ListArticles(f), nil
	}
	s.cacheBypass()
	return s.repo.ListArticles(ctx, f)
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
	if snap := s.snapshot(); snap != nil {
		s.cacheHit()
		return snap.ListPublishedArticlesBySkillKeys(skillKeys), nil
	}
	s.cacheBypass()
	return s.repo.ListPublishedArticlesBySkillKeys(ctx, skillKeys)
}

func (s *catalogService) GetArticle(ctx context.Context, id, slug string) (*catalogmodel.Article, error) {
	switch {
	case id != "":
		if snap := s.snapshot(); snap != nil {
			if article, ok := snap.GetArticleByID(id); ok {
				s.cacheHit()
				return article, nil
			}
			s.cacheHit()
			return nil, ErrNotFound
		}
		s.cacheBypass()
		article, err := s.repo.GetArticleByID(ctx, id)
		if err != nil {
			return nil, err
		}
		return article, nil
	case slug != "":
		if snap := s.snapshot(); snap != nil {
			if article, ok := snap.GetArticleBySlug(slug); ok {
				s.cacheHit()
				return article, nil
			}
			s.cacheHit()
			return nil, ErrNotFound
		}
		s.cacheBypass()
		article, err := s.repo.GetArticleBySlug(ctx, slug)
		if err != nil {
			return nil, err
		}
		return article, nil
	default:
		return nil, ErrInvalidArgument
	}
}

func (s *catalogService) ListRelatedArticles(ctx context.Context, articleID string, skillKeys []string, limit int) ([]catalogmodel.Article, error) {
	if articleID == "" {
		return nil, ErrInvalidArgument
	}
	if snap := s.snapshot(); snap != nil {
		s.cacheHit()
		return snap.ListRelatedArticles(articleID, skillKeys, limit), nil
	}
	s.cacheBypass()
	return s.repo.ListRelatedArticles(ctx, articleID, skillKeys, limit)
}

func (s *catalogService) ResolveTaskIDs(ctx context.Context, slugs []string) ([]string, error) {
	ids := make([]string, 0, len(slugs))
	for _, slug := range slugs {
		slug = strings.TrimSpace(slug)
		if slug == "" {
			continue
		}
		if snap := s.snapshot(); snap != nil {
			task, ok := snap.GetTaskBySlug(slug)
			if !ok {
				return nil, fmt.Errorf("task slug %q: %w", slug, ErrNotFound)
			}
			s.cacheHit()
			ids = append(ids, task.ID)
			continue
		}
		s.cacheBypass()
		task, err := s.repo.GetTaskBySlug(ctx, slug)
		if err != nil {
			return nil, fmt.Errorf("task slug %q: %w", slug, err)
		}
		ids = append(ids, task.ID)
	}
	return ids, nil
}
