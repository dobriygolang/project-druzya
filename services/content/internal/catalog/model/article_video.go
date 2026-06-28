package model

// ArticleVideo is an external video linked from a knowledge-base article.
type ArticleVideo struct {
	ID              string
	ArticleID       string
	Title           string
	URL             string
	Provider        ArticleVideoProvider
	Position        int
	DurationSeconds *int
}
