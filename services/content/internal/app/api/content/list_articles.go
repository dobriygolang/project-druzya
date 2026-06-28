package contentapi

import (
	"context"
	"strings"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

func optionalSearchQuery(raw string) *string {
	q := strings.TrimSpace(raw)
	if q == "" {
		return nil
	}
	return &q
}

// ListArticles returns published knowledge-base articles.
func (i *Implementation) ListArticles(ctx context.Context, req *contentv1.ListArticlesRequest) (*contentv1.ListArticlesResponse, error) {
	if keys := req.GetSkillKeys(); len(keys) > 0 {
		items, err := i.service.ListPublishedArticlesBySkillKeys(ctx, keys)
		if err != nil {
			return nil, mapServiceError(err)
		}
		out := make([]*contentv1.ArticleSummary, 0, len(items))
		for idx := range items {
			out = append(out, toProtoArticleSummary(&items[idx]))
		}
		return &contentv1.ListArticlesResponse{Articles: out}, nil
	}

	var skillKey *string
	if req.SkillKey != nil && *req.SkillKey != "" {
		skillKey = req.SkillKey
	}

	var items []catalogmodel.Article
	var err error
	if req.GetIncludeAllStatuses() || req.GetStatus() != contentv1.ArticleStatus_ARTICLE_STATUS_UNSPECIFIED {
		var statusFilter *catalogmodel.ArticleStatus
		if req.GetStatus() != contentv1.ArticleStatus_ARTICLE_STATUS_UNSPECIFIED {
			parsed, parseErr := articleStatusFromProto(req.GetStatus())
			if parseErr != nil {
				return nil, invalidArgument("invalid article status")
			}
			statusFilter = &parsed
		}
		items, err = i.service.ListArticlesAdmin(ctx, statusFilter, req.GetIncludeAllStatuses(), optionalSearchQuery(req.GetQuery()), int(req.GetLimit()), int(req.GetOffset()))
	} else {
		items, err = i.service.ListArticles(ctx, skillKey, optionalSearchQuery(req.GetQuery()), int(req.GetLimit()), int(req.GetOffset()))
	}
	if err != nil {
		return nil, mapServiceError(err)
	}

	out := make([]*contentv1.ArticleSummary, 0, len(items))
	for idx := range items {
		out = append(out, toProtoArticleSummary(&items[idx]))
	}
	return &contentv1.ListArticlesResponse{Articles: out}, nil
}
