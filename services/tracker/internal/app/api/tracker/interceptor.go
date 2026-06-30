package trackerapi

import (
	"context"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
)

var protectedMethods = map[string]struct{}{
	trackerv1.TrackerService_GetSettings_FullMethodName:              {},
	trackerv1.TrackerService_UpdateSettings_FullMethodName:           {},
	trackerv1.TrackerService_GetGoogleCalendarAuthURL_FullMethodName: {},
	trackerv1.TrackerService_DisconnectGoogleCalendar_FullMethodName: {},
	trackerv1.TrackerService_ListGoogleCalendarEvents_FullMethodName: {},
	trackerv1.TrackerService_ListWorkTasks_FullMethodName:            {},
	trackerv1.TrackerService_CreateWorkTask_FullMethodName:           {},
	trackerv1.TrackerService_UpdateWorkTaskStatus_FullMethodName:     {},
	trackerv1.TrackerService_DeleteWorkTask_FullMethodName:           {},
	trackerv1.TrackerService_ScheduleWorkTask_FullMethodName:         {},
	trackerv1.TrackerService_UnscheduleWorkTask_FullMethodName:       {},
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

func InternalAuthInterceptor(_ string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, _ *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		return handler(ctx, req)
	}
}
