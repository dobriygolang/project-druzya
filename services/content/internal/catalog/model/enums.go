package model

import "fmt"

// ArticleStatus is publication state of a knowledge-base article.
type ArticleStatus string

const (
	ArticleStatusDraft     ArticleStatus = "draft"
	ArticleStatusPublished ArticleStatus = "published"
	ArticleStatusArchived  ArticleStatus = "archived"
)

// ParseArticleStatus validates a DB/API article status string.
func ParseArticleStatus(v string) (ArticleStatus, error) {
	s := ArticleStatus(v)
	switch s {
	case ArticleStatusDraft, ArticleStatusPublished, ArticleStatusArchived:
		return s, nil
	default:
		return "", fmt.Errorf("invalid article status %q", v)
	}
}

// ArticleVideoProvider identifies an external video host.
type ArticleVideoProvider string

const (
	ArticleVideoProviderYouTube ArticleVideoProvider = "youtube"
	ArticleVideoProviderVimeo   ArticleVideoProvider = "vimeo"
	ArticleVideoProviderOther   ArticleVideoProvider = "other"
)

// ParseArticleVideoProvider validates a video provider string.
func ParseArticleVideoProvider(v string) (ArticleVideoProvider, error) {
	p := ArticleVideoProvider(v)
	switch p {
	case ArticleVideoProviderYouTube, ArticleVideoProviderVimeo, ArticleVideoProviderOther:
		return p, nil
	default:
		return "", fmt.Errorf("invalid article video provider %q", v)
	}
}
