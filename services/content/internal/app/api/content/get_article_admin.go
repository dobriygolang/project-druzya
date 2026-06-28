package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// GetArticleForAdmin returns any article by id or slug (admin).
func (i *Implementation) GetArticleForAdmin(ctx context.Context, req *contentv1.GetArticleRequest) (*contentv1.GetArticleResponse, error) {
	if err := requireIDOrSlug(req.GetId(), req.GetSlug()); err != nil {
		return nil, err
	}

	article, err := i.service.GetArticle(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.GetArticleResponse{Article: toProtoArticle(article)}, nil
}
