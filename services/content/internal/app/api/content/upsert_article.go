package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
)

// UpsertArticle creates or updates a knowledge-base article (admin).
func (i *Implementation) UpsertArticle(ctx context.Context, req *contentv1.UpsertArticleRequest) (*contentv1.UpsertArticleResponse, error) {
	status := catalogmodel.ArticleStatusDraft
	if req.GetStatus() != contentv1.ArticleStatus_ARTICLE_STATUS_UNSPECIFIED {
		parsed, err := articleStatusFromProto(req.GetStatus())
		if err != nil {
			return nil, invalidArgument("invalid article status")
		}
		status = parsed
	}
	var readingMinutes *int
	if req.ReadingMinutes != nil {
		v := int(req.GetReadingMinutes())
		readingMinutes = &v
	}
	videos, err := articleVideosFromProto(req.GetVideos())
	if err != nil {
		return nil, invalidArgument("invalid article video")
	}
	taskIDs, err := i.service.ResolveTaskIDs(ctx, req.GetTaskSlugs())
	if err != nil {
		return nil, mapServiceError(err)
	}
	article, err := i.service.UpsertArticle(ctx, catalogmodel.Article{
		ID:             req.GetId(),
		Slug:           req.GetSlug(),
		Title:          req.GetTitle(),
		Summary:        req.GetSummary(),
		Body:           req.GetBody(),
		Status:         status,
		ReadingMinutes: readingMinutes,
		SkillKeys:      req.GetSkillKeys(),
		Videos:         videos,
		TaskIDs:        taskIDs,
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.UpsertArticleResponse{Article: toProtoArticle(article)}, nil
}
