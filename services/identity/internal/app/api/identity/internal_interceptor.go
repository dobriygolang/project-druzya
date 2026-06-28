package identityapi

import (
	"context"
	"strings"

	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

const internalTokenHeader = "x-internal-token"

// internalMethods are service-to-service RPCs with no HTTP mapping. They must be
// callable only by trusted internal callers presenting the shared token.
var internalMethods = map[string]struct{}{
	identityv1.IdentityService_GetUser_FullMethodName:              {},
	identityv1.IdentityService_GetUserByTelegramID_FullMethodName:  {},
	identityv1.IdentityService_ValidateToken_FullMethodName:           {},
	identityv1.IdentityService_MintScopedAccessToken_FullMethodName: {},
	identityv1.IdentityService_GetUserStats_FullMethodName:          {},
	identityv1.IdentityService_GetOpsStats_FullMethodName:           {},
}

// InternalAuthInterceptor enforces the internal token on service-to-service RPCs.
func InternalAuthInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if _, ok := internalMethods[info.FullMethod]; !ok {
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
		if len(vals) == 0 || strings.TrimSpace(vals[0]) != token {
			return nil, status.Error(codes.Unauthenticated, "invalid internal token")
		}
		return handler(ctx, req)
	}
}
