package identitygrpc

import (
	"context"
	"fmt"

	identityadapter "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/identity"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

type Client struct {
	client identityv1.IdentityServiceClient
	conn   *grpc.ClientConn
	token  string
}

func NewClient(ctx context.Context, addr, token string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial identity grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: identityv1.NewIdentityServiceClient(conn),
		conn:   conn,
		token:  token,
	}, nil
}

func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) authCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, internalTokenHeader, c.token)
}

func (c *Client) MintScopedAccessToken(
	ctx context.Context,
	role, scope, displayName string,
	ttlSeconds int32,
) (string, string, error) {
	resp, err := c.client.MintScopedAccessToken(c.authCtx(ctx), &identityv1.MintScopedAccessTokenRequest{
		Role:        role,
		Scope:       scope,
		DisplayName: displayName,
		TtlSeconds:  ttlSeconds,
	})
	if err != nil {
		return "", "", err
	}
	return resp.GetAccessToken(), resp.GetUserId(), nil
}

var _ identityadapter.TokenMinter = (*Client)(nil)
