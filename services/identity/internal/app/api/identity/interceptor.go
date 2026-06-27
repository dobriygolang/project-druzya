package identityapi

import (
	"context"

	authservice "github.com/sedorofeevd/project-druzya/services/identity/internal/auth/service"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/grpc"
)

var protectedMethods = map[string]struct{}{
	identityv1.IdentityService_GetMe_FullMethodName:      {},
	identityv1.IdentityService_Logout_FullMethodName:     {},
	identityv1.IdentityService_LinkYandex_FullMethodName: {},
}

// AuthInterceptor validates Bearer tokens for protected RPC methods.
func AuthInterceptor(svc authservice.Service) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if _, ok := protectedMethods[info.FullMethod]; !ok {
			return handler(ctx, req)
		}

		token := BearerTokenFromContext(ctx)
		userID, err := svc.ValidateToken(ctx, token)
		if err != nil {
			return nil, unauthorized()
		}

		return handler(WithUserID(ctx, userID), req)
	}
}
