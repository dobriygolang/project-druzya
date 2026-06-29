package focusapi

import (
	"context"

	focusv1 "github.com/sedorofeevd/project-druzya/services/focus/pkg/api/focus/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
)

var protectedMethods = map[string]struct{}{
	focusv1.FocusService_StartFocusSession_FullMethodName: {},
	focusv1.FocusService_EndFocusSession_FullMethodName:   {},
	focusv1.FocusService_GetStats_FullMethodName:          {},
}

func AuthInterceptor(v *jwt.Validator) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if _, ok := protectedMethods[info.FullMethod]; !ok {
			return handler(ctx, req)
		}
		token := BearerTokenFromContext(ctx)
		userID, err := v.UserID(token)
		if err != nil {
			return nil, unauthorized()
		}
		return handler(WithUserID(ctx, userID), req)
	}
}
