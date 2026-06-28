package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
)

var protectedMethods = map[string]struct{}{
	billingv1.BillingService_GetMe_FullMethodName:          {},
	billingv1.BillingService_StartProTrial_FullMethodName: {},
}

// AuthInterceptor validates Bearer JWT for user-facing RPC methods.
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
