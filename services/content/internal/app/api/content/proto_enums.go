package contentapi

import (
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

func articleStatusToProto(s catalogmodel.ArticleStatus) contentv1.ArticleStatus {
	switch s {
	case catalogmodel.ArticleStatusDraft:
		return contentv1.ArticleStatus_ARTICLE_STATUS_DRAFT
	case catalogmodel.ArticleStatusPublished:
		return contentv1.ArticleStatus_ARTICLE_STATUS_PUBLISHED
	case catalogmodel.ArticleStatusArchived:
		return contentv1.ArticleStatus_ARTICLE_STATUS_ARCHIVED
	default:
		return contentv1.ArticleStatus_ARTICLE_STATUS_UNSPECIFIED
	}
}

func articleStatusFromProto(s contentv1.ArticleStatus) (catalogmodel.ArticleStatus, error) {
	switch s {
	case contentv1.ArticleStatus_ARTICLE_STATUS_DRAFT:
		return catalogmodel.ArticleStatusDraft, nil
	case contentv1.ArticleStatus_ARTICLE_STATUS_PUBLISHED:
		return catalogmodel.ArticleStatusPublished, nil
	case contentv1.ArticleStatus_ARTICLE_STATUS_ARCHIVED:
		return catalogmodel.ArticleStatusArchived, nil
	default:
		return "", fmt.Errorf("unknown article status: %v", s)
	}
}

func articleVideoProviderToProto(p catalogmodel.ArticleVideoProvider) contentv1.ArticleVideoProvider {
	switch p {
	case catalogmodel.ArticleVideoProviderYouTube:
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_YOUTUBE
	case catalogmodel.ArticleVideoProviderVimeo:
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_VIMEO
	case catalogmodel.ArticleVideoProviderOther:
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_OTHER
	default:
		return contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_UNSPECIFIED
	}
}

func articleVideoProviderFromProto(p contentv1.ArticleVideoProvider) (catalogmodel.ArticleVideoProvider, error) {
	switch p {
	case contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_YOUTUBE:
		return catalogmodel.ArticleVideoProviderYouTube, nil
	case contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_VIMEO:
		return catalogmodel.ArticleVideoProviderVimeo, nil
	case contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_OTHER:
		return catalogmodel.ArticleVideoProviderOther, nil
	default:
		return "", fmt.Errorf("unknown article video provider: %v", p)
	}
}

func articleVideosFromProto(videos []*contentv1.ArticleVideo) ([]catalogmodel.ArticleVideo, error) {
	if len(videos) == 0 {
		return nil, nil
	}
	out := make([]catalogmodel.ArticleVideo, 0, len(videos))
	for _, v := range videos {
		if v == nil {
			continue
		}
		provider := catalogmodel.ArticleVideoProviderYouTube
		if v.GetProvider() != contentv1.ArticleVideoProvider_ARTICLE_VIDEO_PROVIDER_UNSPECIFIED {
			parsed, err := articleVideoProviderFromProto(v.GetProvider())
			if err != nil {
				return nil, err
			}
			provider = parsed
		}
		var duration *int
		if v.DurationSeconds != nil {
			d := int(v.GetDurationSeconds())
			duration = &d
		}
		out = append(out, catalogmodel.ArticleVideo{
			Title:           v.GetTitle(),
			URL:             v.GetUrl(),
			Provider:        provider,
			Position:        int(v.GetPosition()),
			DurationSeconds: duration,
		})
	}
	return out, nil
}

func toProtoArticleVideos(videos []catalogmodel.ArticleVideo) []*contentv1.ArticleVideo {
	if len(videos) == 0 {
		return nil
	}
	out := make([]*contentv1.ArticleVideo, 0, len(videos))
	for _, v := range videos {
		item := &contentv1.ArticleVideo{
			Title:    v.Title,
			Url:      v.URL,
			Provider: articleVideoProviderToProto(v.Provider),
			Position: int32(v.Position),
		}
		if v.DurationSeconds != nil {
			d := int32(*v.DurationSeconds)
			item.DurationSeconds = &d
		}
		out = append(out, item)
	}
	return out
}
