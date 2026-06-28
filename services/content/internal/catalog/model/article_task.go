package model

// ArticleTaskLink is a catalog task recommended after reading an article.
type ArticleTaskLink struct {
	TaskID     string
	Slug       string
	Title      string
	Type       string
	Difficulty string
	Position   int
}
