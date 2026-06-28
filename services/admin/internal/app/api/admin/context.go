package adminapi

import (
	"context"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
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
	value := strings.TrimSpace(values[0])
	if len(value) < 8 || !strings.EqualFold(value[:7], "bearer ") {
		return ""
	}
	return strings.TrimSpace(value[7:])
}

// AuthInterceptor validates JWT and admin allowlist for AdminService RPCs.
func AuthInterceptor(validator *jwt.Validator, allowlist map[string]struct{}) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if !strings.HasPrefix(info.FullMethod, "/admin.v1.AdminService/") {
			return handler(ctx, req)
		}

		token := BearerTokenFromContext(ctx)
		userID, err := validator.UserID(token)
		if err != nil {
			return nil, unauthorized()
		}
		if _, ok := allowlist[userID]; !ok {
			return nil, permissionDenied()
		}
		return handler(WithUserID(ctx, userID), req)
	}
}

func requireUserID(ctx context.Context) (string, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return "", unauthorized()
	}
	return userID, nil
}
