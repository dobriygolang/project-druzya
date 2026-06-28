package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ListArticles returns knowledge-base articles for admin UI.
func (i *Implementation) ListArticles(ctx context.Context, req *adminv1.ListArticlesRequest) (*adminv1.ListArticlesResponse, error) {
	filter := contentadapter.ListArticlesFilter{
		IncludeAll: true,
		Limit:      int(req.GetLimit()),
		Offset:     int(req.GetOffset()),
	}
	if req.GetStatus() != adminv1.ArticleStatus_ARTICLE_STATUS_UNSPECIFIED {
		status := articleStatusFromProto(req.GetStatus())
		filter.Status = &status
	}
	items, err := i.service.ListArticles(ctx, filter)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*adminv1.Article, 0, len(items))
	for _, item := range items {
		out = append(out, toProtoArticle(item))
	}
	return &adminv1.ListArticlesResponse{Articles: out}, nil
}

// GetArticle returns one article by id or slug.
func (i *Implementation) GetArticle(ctx context.Context, req *adminv1.GetArticleRequest) (*adminv1.GetArticleResponse, error) {
	article, err := i.service.GetArticle(ctx, req.GetId(), req.GetSlug())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.GetArticleResponse{Article: toProtoArticle(*article)}, nil
}

// UpsertArticle creates or updates an article.
func (i *Implementation) UpsertArticle(ctx context.Context, req *adminv1.UpsertArticleRequest) (*adminv1.UpsertArticleResponse, error) {
	input := contentadapter.UpsertArticleInput{
		ID:        optionalString(req.Id),
		Slug:      req.GetSlug(),
		Title:     req.GetTitle(),
		Summary:   req.GetSummary(),
		Body:      req.GetBody(),
		Status:    articleStatusFromProto(req.GetStatus()),
		SkillKeys: req.GetSkillKeys(),
	}
	if input.Status == "" {
		input.Status = "draft"
	}
	if req.ReadingMinutes != nil {
		v := int(req.GetReadingMinutes())
		input.ReadingMinutes = &v
	}
	input.Videos = articleVideosFromProto(req.GetVideos())
	input.TaskSlugs = req.GetTaskSlugs()
	article, err := i.service.UpsertArticle(ctx, input)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.UpsertArticleResponse{Article: toProtoArticle(*article)}, nil
}
