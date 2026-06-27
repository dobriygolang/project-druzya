package identityapi

import (
	"context"

	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
)

// MintScopedAccessToken issues a scoped guest access token (internal s2s).
func (i *Implementation) MintScopedAccessToken(
	ctx context.Context,
	req *identityv1.MintScopedAccessTokenRequest,
) (*identityv1.MintScopedAccessTokenResponse, error) {
	if req.GetScope() == "" {
		return nil, invalidArgument("scope is required")
	}
	token, userID, expiresIn, err := i.service.MintScopedAccessToken(
		ctx,
		req.GetRole(),
		req.GetScope(),
		req.GetDisplayName(),
		req.GetTtlSeconds(),
	)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &identityv1.MintScopedAccessTokenResponse{
		AccessToken: token,
		UserId:      userID,
		ExpiresIn:   expiresIn,
	}, nil
}
