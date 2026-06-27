package sandboxapi

import (
	"context"
	"strings"

	"google.golang.org/grpc/metadata"
)

type ctxKey int

const (
	userIDKey ctxKey = 1
	tokenKey  ctxKey = 2
)

// WithUserID stores authenticated user ID in context.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

// WithBearerToken stores the raw bearer token for downstream forwarding.
func WithBearerToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, tokenKey, token)
}

// UserIDFromContext returns authenticated user ID from context.
func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(userIDKey).(string)
	return userID, ok && userID != ""
}

// BearerTokenFromContext extracts Bearer token from incoming gRPC metadata or context.
func BearerTokenFromContext(ctx context.Context) string {
	if v, ok := ctx.Value(tokenKey).(string); ok && v != "" {
		return v
	}
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	values := md.Get("authorization")
	if len(values) == 0 {
		return ""
	}
	value := strings.TrimSpace(values[0])
	if len(value) < 8 || !strings.EqualFold(value[:7], "bearer ") {
		return ""
	}
	return strings.TrimSpace(value[7:])
}

func requireUserID(ctx context.Context) (string, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return "", unauthorized()
	}
	return userID, nil
}
