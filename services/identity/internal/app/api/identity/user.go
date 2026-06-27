package identityapi

import (
	"context"

	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/protobuf/types/known/emptypb"
)

// GetMe returns the authenticated user profile.
func (i *Implementation) GetMe(ctx context.Context, _ *emptypb.Empty) (*identityv1.GetUserResponse, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return nil, unauthorized()
	}

	user, err := i.service.GetMe(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &identityv1.GetUserResponse{User: toProtoUser(user)}, nil
}

// GetUser returns user by id for internal service-to-service calls.
func (i *Implementation) GetUser(ctx context.Context, req *identityv1.GetUserRequest) (*identityv1.GetUserResponse, error) {
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}

	user, err := i.service.GetUser(ctx, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &identityv1.GetUserResponse{User: toProtoUser(user)}, nil
}

// GetUserByTelegramID returns user by Telegram id for internal service-to-service calls.
func (i *Implementation) GetUserByTelegramID(ctx context.Context, req *identityv1.GetUserByTelegramIDRequest) (*identityv1.GetUserResponse, error) {
	if req.GetTelegramId() == 0 {
		return nil, invalidArgument("telegram_id is required")
	}

	user, err := i.service.GetUserByTelegramID(ctx, req.GetTelegramId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &identityv1.GetUserResponse{User: toProtoUser(user)}, nil
}
