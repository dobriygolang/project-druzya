package identityapi

import (
	"context"

	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
)

// AuthTelegram exchanges a Telegram login code for tokens.
func (i *Implementation) AuthTelegram(ctx context.Context, req *identityv1.AuthTelegramRequest) (*identityv1.AuthResponse, error) {
	if req.GetCode() == "" {
		return nil, invalidArgument("code is required")
	}

	result, err := i.service.AuthTelegram(ctx, req.GetCode())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toAuthResponse(result), nil
}
