package billinggrpc

import (
	"context"
	"fmt"

	billingadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/billing"
	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

// Client calls billing-service internal RPCs.
type Client struct {
	client billingv1.BillingInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

// NewClient dials billing-service.
func NewClient(ctx context.Context, addr, token string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial billing grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: billingv1.NewBillingInternalServiceClient(conn),
		conn:   conn,
		token:  token,
	}, nil
}

// Close releases the connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) authCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, internalTokenHeader, c.token)
}

// CheckAndConsumeUsage atomically reserves billable usage.
func (c *Client) CheckAndConsumeUsage(ctx context.Context, userID, key string, amount int) error {
	if key == "" {
		key = billingadapter.EntitlementAIEvaluationsPerDay
	}
	if amount <= 0 {
		amount = 1
	}
	resp, err := c.client.CheckAndConsumeUsage(c.authCtx(ctx), &billingv1.CheckAndConsumeUsageRequest{
		UserId: userID,
		Key:    key,
		Amount: int32(amount),
	})
	if err != nil {
		return err
	}
	if !resp.GetAllowed() {
		return billingadapter.ErrQuotaExceeded
	}
	return nil
}

var _ billingadapter.Client = (*Client)(nil)
