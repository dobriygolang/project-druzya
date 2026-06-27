package billingapi

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const internalTokenHeader = "x-internal-token"

// InternalAuthInterceptor validates internal token for internal/admin RPCs.
func InternalAuthInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if !strings.Contains(info.FullMethod, "BillingInternalService/") &&
			!strings.Contains(info.FullMethod, "BillingAdminService/") {
			return handler(ctx, req)
		}
		if token == "" {
			return nil, status.Error(codes.Unauthenticated, "internal token not configured")
		}
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}
		vals := md.Get(internalTokenHeader)
		if len(vals) == 0 || vals[0] != token {
			return nil, status.Error(codes.Unauthenticated, "invalid internal token")
		}
		return handler(ctx, req)
	}
}
