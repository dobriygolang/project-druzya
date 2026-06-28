package recommendationapi

import (
	"context"
	"strings"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	localepkg "github.com/sedorofeevd/project-druzya/services/recommendation/internal/tools/locale"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
)

const internalServicePrefix = "/recommendation.v1.RecommendationInternalService/"

var protectedMethods = map[string]struct{}{
	recommendationv1.RecommendationService_GetDashboard_FullMethodName:             {},
	recommendationv1.RecommendationService_GetMockHubContext_FullMethodName:        {},
	recommendationv1.RecommendationService_DismissRecommendation_FullMethodName:    {},
	recommendationv1.RecommendationService_CompleteRecommendation_FullMethodName:   {},
	recommendationv1.RecommendationService_CompleteLearningPlanItem_FullMethodName: {},
	recommendationv1.RecommendationService_DismissLearningPlanItem_FullMethodName:  {},
	recommendationv1.RecommendationService_MarkArticleRead_FullMethodName:          {},
}

// AuthInterceptor validates Bearer JWT for user-facing RPC methods.
func AuthInterceptor(v *jwt.Validator) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		ctx = localeFromMetadata(ctx)

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

func localeFromMetadata(ctx context.Context) context.Context {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return ctx
	}
	vals := md.Get("accept-language")
	if len(vals) == 0 {
		return ctx
	}
	return localepkg.With(ctx, localepkg.ParseAcceptLanguage(vals[0]))
}
