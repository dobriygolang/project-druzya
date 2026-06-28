package locale

import (
	"context"
	"strings"
)

type ctxKey struct{}

const (
	RU      = "ru"
	EN      = "en"
	Default = RU
)

// With stores normalized locale on context.
func With(ctx context.Context, lang string) context.Context {
	return context.WithValue(ctx, ctxKey{}, Normalize(lang))
}

// From reads locale from context.
func From(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKey{}).(string); ok && v != "" {
		return v
	}
	return Default
}

// Normalize maps input to ru or en.
func Normalize(lang string) string {
	lang = strings.ToLower(strings.TrimSpace(lang))
	if strings.HasPrefix(lang, "en") {
		return EN
	}
	return RU
}

// ParseAcceptLanguage picks primary tag from Accept-Language header value.
func ParseAcceptLanguage(header string) string {
	if header == "" {
		return Default
	}
	part := strings.TrimSpace(strings.Split(header, ",")[0])
	part = strings.TrimSpace(strings.Split(part, ";")[0])
	return Normalize(part)
}
