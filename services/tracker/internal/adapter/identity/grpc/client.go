package identitygrpc

import (
	"context"
	"fmt"

	identityadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/identity"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

// Client calls identity-service gRPC APIs.
type Client struct {
	client identityv1.IdentityServiceClient
	conn   *grpc.ClientConn
}

// NewClient dials identity-service.
func NewClient(ctx context.Context, addr, internalToken string) (*Client, error) {
	conn, err := grpc.NewClient(addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithUnaryInterceptor(internalTokenInterceptor(internalToken)),
	)
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
	}, nil
}

// Close releases the connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) GetUser(ctx context.Context, userID string) (*identityadapter.User, error) {
	resp, err := c.client.GetUser(ctx, &identityv1.GetUserRequest{Id: userID})
	if err != nil {
		return nil, err
	}
	return toUser(resp.GetUser()), nil
}

func internalTokenInterceptor(token string) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply any, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		if token != "" {
			ctx = metadata.AppendToOutgoingContext(ctx, internalTokenHeader, token)
		}
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

func toUser(u *identityv1.User) *identityadapter.User {
	if u == nil {
		return nil
	}
	return &identityadapter.User{ID: u.GetId(), Timezone: u.GetTimezone()}
}

var _ identityadapter.Client = (*Client)(nil)
