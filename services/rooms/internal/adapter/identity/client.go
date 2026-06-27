package identity

import (
	"context"
	"errors"
)

var ErrUnavailable = errors.New("identity token minter unavailable")

type TokenMinter interface {
	MintScopedAccessToken(ctx context.Context, role, scope, displayName string, ttlSeconds int32) (accessToken, userID string, err error)
}
