package roomsapi

import (
	"context"

	roomsv1 "github.com/sedorofeevd/project-druzya/services/rooms/pkg/api/rooms/v1"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
)

var protectedMethods = map[string]struct{}{
	roomsv1.RoomsService_CreateRoom_FullMethodName:         {},
	roomsv1.RoomsService_GetRoom_FullMethodName:            {},
	roomsv1.RoomsService_JoinRoom_FullMethodName:           {},
	roomsv1.RoomsService_FreezeRoom_FullMethodName:         {},
	roomsv1.RoomsService_CreateInvite_FullMethodName:         {},
	roomsv1.RoomsService_GetReplay_FullMethodName:            {},
	roomsv1.RoomsService_ListMyActiveRooms_FullMethodName:    {},
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
