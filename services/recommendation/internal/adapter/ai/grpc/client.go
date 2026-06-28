package aigrpc

import (
	"context"
	"fmt"

	aiadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/ai"
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

type Client struct {
	client aiv1.AiInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

func NewClient(ctx context.Context, addr, token string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial ai grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: aiv1.NewAiInternalServiceClient(conn),
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

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.client.ListEvaluationJobs(c.authCtx(ctx), &aiv1.ListEvaluationJobsRequest{Limit: 1})
	return err
}

func (c *Client) ClassifyTrackerTask(ctx context.Context, title string) (*aiadapter.ClassifyResult, error) {
	resp, err := c.client.ClassifyTrackerTask(c.authCtx(ctx), &aiv1.ClassifyTrackerTaskRequest{Title: title})
	if err != nil {
		return nil, err
	}
	meta := map[string]any{}
	if resp.GetMetadata() != nil {
		meta = resp.GetMetadata().AsMap()
	}
	return &aiadapter.ClassifyResult{
		Kind:     resp.GetKind(),
		Metadata: meta,
		EpicHint: resp.EpicHint,
	}, nil
}

var _ aiadapter.Client = (*Client)(nil)
