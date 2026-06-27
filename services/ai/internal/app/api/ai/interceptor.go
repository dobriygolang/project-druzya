package aiapi

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

// InternalAuthInterceptor validates x-internal-token for internal RPC methods.
func InternalAuthInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if !strings.HasPrefix(info.FullMethod, internalServicePrefix) {
			return handler(ctx, req)
		}
		if token == "" {
			return nil, unauthorized()
		}
		if InternalTokenFromContext(ctx) != token {
			return nil, unauthorized()
		}
		return handler(ctx, req)
	}
}

// InternalTokenFromContext reads service-to-service token from metadata.
func InternalTokenFromContext(ctx context.Context) string {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ""
	}
	if values := md.Get("x-internal-token"); len(values) > 0 {
		return strings.TrimSpace(values[0])
	}
	return ""
}
