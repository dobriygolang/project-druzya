package recommendationapi

import (
	"context"
	"strings"

	"google.golang.org/grpc"
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
