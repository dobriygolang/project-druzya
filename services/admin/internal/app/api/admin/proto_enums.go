package adminapi

import (
	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func articleStatusToProto(status string) adminv1.ArticleStatus {
	switch status {
	case "draft":
		return adminv1.ArticleStatus_ARTICLE_STATUS_DRAFT
	case "published":
		return adminv1.ArticleStatus_ARTICLE_STATUS_PUBLISHED
	case "archived":
		return adminv1.ArticleStatus_ARTICLE_STATUS_ARCHIVED
	default:
		return adminv1.ArticleStatus_ARTICLE_STATUS_UNSPECIFIED
	}
}

func articleStatusFromProto(status adminv1.ArticleStatus) string {
	switch status {
	case adminv1.ArticleStatus_ARTICLE_STATUS_DRAFT:
		return "draft"
	case adminv1.ArticleStatus_ARTICLE_STATUS_PUBLISHED:
		return "published"
	case adminv1.ArticleStatus_ARTICLE_STATUS_ARCHIVED:
		return "archived"
	default:
		return ""
	}
}

func articleVideoProviderToProto(raw string) (adminv1.ArticleVideoProvider, bool) {
	switch raw {
	case "youtube":
		return adminv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_YOUTUBE, true
	case "vimeo":
		return adminv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_VIMEO, true
	case "other":
		return adminv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_OTHER, true
	default:
		return adminv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_UNSPECIFIED, false
	}
}

func articleVideoProviderFromProto(p adminv1.ArticleVideoProvider) string {
	switch p {
	case adminv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_YOUTUBE:
		return "youtube"
	case adminv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_VIMEO:
		return "vimeo"
	case adminv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_OTHER:
		return "other"
	default:
		return "youtube"
	}
}

func toProtoArticleVideos(videos []contentadapter.ArticleVideo) []*adminv1.ArticleVideo {
	if len(videos) == 0 {
		return nil
	}
	out := make([]*adminv1.ArticleVideo, 0, len(videos))
	for _, v := range videos {
		item := &adminv1.ArticleVideo{
			Title:    v.Title,
			Url:      v.URL,
			Position: int32(v.Position),
		}
		if p, ok := articleVideoProviderToProto(v.Provider); ok {
			item.Provider = p
		}
		if v.DurationSeconds != nil {
			d := int32(*v.DurationSeconds)
			item.DurationSeconds = &d
		}
		out = append(out, item)
	}
	return out
}

func articleVideosFromProto(videos []*adminv1.ArticleVideo) []contentadapter.ArticleVideo {
	if len(videos) == 0 {
		return nil
	}
	out := make([]contentadapter.ArticleVideo, 0, len(videos))
	for _, v := range videos {
		if v == nil {
			continue
		}
		item := contentadapter.ArticleVideo{
			Title:    v.GetTitle(),
			URL:      v.GetUrl(),
			Provider: articleVideoProviderFromProto(v.GetProvider()),
			Position: int(v.GetPosition()),
		}
		if v.DurationSeconds != nil {
			d := int(v.GetDurationSeconds())
			item.DurationSeconds = &d
		}
		out = append(out, item)
	}
	return out
}

func toProtoArticleTaskLinks(links []contentadapter.ArticleTaskLink) []*adminv1.ArticleTaskLink {
	if len(links) == 0 {
		return nil
	}
	out := make([]*adminv1.ArticleTaskLink, 0, len(links))
	for _, link := range links {
		out = append(out, &adminv1.ArticleTaskLink{
			TaskId:     link.TaskID,
			Slug:       link.Slug,
			Title:      link.Title,
			Type:       link.Type,
			Difficulty: link.Difficulty,
			Position:   int32(link.Position),
		})
	}
	return out
}

func toProtoArticle(a contentadapter.Article) *adminv1.Article {
	out := &adminv1.Article{
		Id:        a.ID,
		Slug:      a.Slug,
		Title:     a.Title,
		Summary:   a.Summary,
		Body:      a.Body,
		Status:    articleStatusToProto(a.Status),
		SkillKeys: a.SkillKeys,
		Videos:    toProtoArticleVideos(a.Videos),
		LinkedTasks: toProtoArticleTaskLinks(a.LinkedTasks),
		CreatedAt: timestamppb.New(a.CreatedAt),
		UpdatedAt: timestamppb.New(a.UpdatedAt),
	}
	if a.ReadingMinutes != nil {
		v := int32(*a.ReadingMinutes)
		out.ReadingMinutes = &v
	}
	return out
}
