package identityapi

import (
	"context"

	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
)

func (i *Implementation) UpdateMe(ctx context.Context, req *identityv1.UpdateMeRequest) (*identityv1.GetUserResponse, error) {
	userID, ok := UserIDFromContext(ctx)
	if !ok {
		return nil, unauthorized()
	}
	var tz *string
	if req.Timezone != nil {
		tz = req.Timezone
	}
	user, err := i.service.UpdateMe(ctx, userID, tz)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &identityv1.GetUserResponse{User: toProtoUser(user)}, nil
}
