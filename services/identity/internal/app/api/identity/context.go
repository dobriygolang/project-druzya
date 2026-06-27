package identityapi

import (
	"context"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
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
	value := strings.TrimSpace(values[0])
	if len(value) < 8 || !strings.EqualFold(value[:7], "bearer ") {
		return ""
	}
	return strings.TrimSpace(value[7:])
}

func unauthorized() error {
	return status.Error(codes.Unauthenticated, "unauthorized")
}

func invalidArgument(message string) error {
	return status.Error(codes.InvalidArgument, message)
}

func notFound(message string) error {
	return status.Error(codes.NotFound, message)
}

func failedPrecondition(message string) error {
	return status.Error(codes.FailedPrecondition, message)
}
