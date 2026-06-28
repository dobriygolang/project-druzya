package interviewapi

import (
	"context"
	"strings"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
)

const internalServicePrefix = "/interview.v1.InterviewInternalService/"

var protectedMethods = map[string]struct{}{
	interviewv1.InterviewService_StartInterviewSession_FullMethodName:   {},
	interviewv1.InterviewService_GetInterviewSession_FullMethodName:     {},
	interviewv1.InterviewService_GetCurrentSessionState_FullMethodName: {},
	interviewv1.InterviewService_GetSessionResults_FullMethodName:     {},
	interviewv1.InterviewService_CancelSession_FullMethodName:           {},
	interviewv1.InterviewService_GetActiveSession_FullMethodName:      {},
	interviewv1.InterviewService_SubmitAttempt_FullMethodName:           {},
	interviewv1.InterviewService_SkipTask_FullMethodName:                {},
	interviewv1.InterviewService_GetAttempt_FullMethodName:              {},
	interviewv1.InterviewService_ListRetryItems_FullMethodName:          {},
	interviewv1.InterviewService_DismissRetryItem_FullMethodName:        {},
	interviewv1.InterviewService_StartRetrySession_FullMethodName:       {},
}

// AuthInterceptor validates Bearer JWT for user-facing RPC methods.
func AuthInterceptor(v *jwt.Validator) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if strings.HasPrefix(info.FullMethod, internalServicePrefix) {
			return handler(ctx, req)
		}
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
