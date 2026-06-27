package billingapi

import (
	"context"

	"google.golang.org/grpc/metadata"
)

type ctxKey int

const userIDKey ctxKey = 1

// WithUserID stores authenticated user ID in context.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

// UserIDFromContext returns authenticated user ID from context.
func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(userIDKey).(string)
	return userID, ok && userID != ""
}

// BearerTokenFromContext extracts Bearer token from incoming gRPC metadata.
func BearerTokenFromContext(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	values := md.Get("authorization")
	if len(values) == 0 {
		return ""
	}
	value := values[0]
	if len(value) < 8 {
		return ""
	}
	const prefix = "Bearer "
	if len(value) >= len(prefix) && value[:len(prefix)] == prefix {
		return value[len(prefix):]
	}
	return ""
}

func requireUserID(ctx context.Context) (string, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return "", unauthorized()
	}
	return userID, nil
}
