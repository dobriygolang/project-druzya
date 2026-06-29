package trackerapi

import (
	"context"
	"strings"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const internalServicePrefix = "/tracker.v1.TrackerInternalService/"

var protectedMethods = map[string]struct{}{
	trackerv1.TrackerService_GetBoard_FullMethodName:                    {},
	trackerv1.TrackerService_CreateProject_FullMethodName:               {},
	trackerv1.TrackerService_CreateEpic_FullMethodName:                  {},
	trackerv1.TrackerService_CreateSprint_FullMethodName:                {},
	trackerv1.TrackerService_CreateTask_FullMethodName:                  {},
	trackerv1.TrackerService_UpdateTask_FullMethodName:                  {},
	trackerv1.TrackerService_ListSprintTasks_FullMethodName:             {},
	trackerv1.TrackerService_ArchiveSprint_FullMethodName:               {},
	trackerv1.TrackerService_ExportBoard_FullMethodName:                 {},
	trackerv1.TrackerService_GetSettings_FullMethodName:                 {},
	trackerv1.TrackerService_UpdateSettings_FullMethodName:              {},
	trackerv1.TrackerService_GetGoogleCalendarAuthURL_FullMethodName:    {},
	trackerv1.TrackerService_DisconnectGoogleCalendar_FullMethodName:    {},
}

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

func InternalAuthInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if !strings.HasPrefix(info.FullMethod, internalServicePrefix) {
			return handler(ctx, req)
		}
		if InternalTokenFromContext(ctx) != token {
			return nil, status.Error(codes.Unauthenticated, "invalid internal token")
		}
		return handler(ctx, req)
	}
}
