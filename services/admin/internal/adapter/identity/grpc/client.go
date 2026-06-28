package identitygrpc

import (
	"context"
	"fmt"

	identityadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/identity"
	identityv1 "github.com/sedorofeevd/project-druzya/services/identity/pkg/api/identity/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

// Client calls identity-service internal gRPC APIs.
type Client struct {
	internal identityv1.IdentityServiceClient
	conn     *grpc.ClientConn
	token    string
}

// NewClient dials identity-service gRPC endpoint.
func NewClient(ctx context.Context, addr, internalToken string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial identity grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		internal: identityv1.NewIdentityServiceClient(conn),
		conn:     conn,
		token:    internalToken,
	}, nil
}

// Close releases the gRPC connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) internalCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, internalTokenHeader, c.token)
}

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.internal.GetUserStats(c.internalCtx(ctx), &identityv1.GetUserStatsRequest{})
	return err
}

func (c *Client) GetUserStats(ctx context.Context) (*identityadapter.UserStats, error) {
	resp, err := c.internal.GetUserStats(c.internalCtx(ctx), &identityv1.GetUserStatsRequest{})
	if err != nil {
		return nil, err
	}
	return &identityadapter.UserStats{
		TotalUsers:    resp.GetTotalUsers(),
		NewUsers24h:   resp.GetNewUsers_24H(),
		NewUsers7d:    resp.GetNewUsers_7D(),
		NewUsers30d:   resp.GetNewUsers_30D(),
		ActiveUsers7d: resp.GetActiveUsers_7D(),
	}, nil
}

func (c *Client) GetOpsStats(ctx context.Context) (*identityadapter.OpsStats, error) {
	resp, err := c.internal.GetOpsStats(c.internalCtx(ctx), &identityv1.GetOpsStatsRequest{})
	if err != nil {
		return nil, err
	}
	return fromProtoOpsStats(resp), nil
}

func fromProtoOpsStats(resp *identityv1.GetOpsStatsResponse) *identityadapter.OpsStats {
	if resp == nil {
		return &identityadapter.OpsStats{}
	}
	return &identityadapter.OpsStats{
		ServiceName:       resp.GetServiceName(),
		DatabaseName:      resp.GetDatabaseName(),
		DatabaseSizeBytes: resp.GetDatabaseSizeBytes(),
		MemoryAllocBytes:  resp.GetMemoryAllocBytes(),
		MemorySysBytes:    resp.GetMemorySysBytes(),
		Goroutines:        int(resp.GetGoroutines()),
		HTTPRPS:           resp.GetHttpRps(),
	}
}

var _ identityadapter.Client = (*Client)(nil)
