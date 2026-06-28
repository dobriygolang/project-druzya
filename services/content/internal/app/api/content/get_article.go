package contentapi

import (
	"context"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// GetArticle returns a published knowledge-base article by id or slug.
func (i *Implementation) GetArticle(ctx context.Context, req *contentv1.GetArticleRequest) (*contentv1.GetArticleResponse, error) {
	if err := requireIDOrSlug(req.GetId(), req.GetSlug()); err != nil {
		return nil, err
	}

	article, err := i.service.GetArticle(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	if article.Status != catalogmodel.ArticleStatusPublished {
		return nil, notFound("not found")
	}
	related, err := i.service.ListRelatedArticles(ctx, article.ID, article.SkillKeys, 4)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*contentv1.ArticleSummary, 0, len(related))
	for idx := range related {
		out = append(out, toProtoArticleSummary(&related[idx]))
	}
	return &contentv1.GetArticleResponse{Article: toProtoArticle(article), RelatedArticles: out}, nil
}
