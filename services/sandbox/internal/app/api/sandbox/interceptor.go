package sandboxapi

import (
	"context"

	sandboxv1 "github.com/sedorofeevd/project-druzya/services/sandbox/pkg/api/sandbox/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
)

var protectedMethods = map[string]struct{}{
	sandboxv1.SandboxService_RunCode_FullMethodName:                  {},
	sandboxv1.SandboxService_GetCodeRun_FullMethodName:               {},
	sandboxv1.SandboxService_ListCodeRuns_FullMethodName:             {},
	sandboxv1.SandboxService_SubmitAttemptFromCodeRun_FullMethodName: {},
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
		ctx = WithUserID(ctx, userID)
		ctx = WithBearerToken(ctx, token)
		return handler(ctx, req)
	}
}
