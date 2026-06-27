package contentgrpc

import (
	"context"
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/content"
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
)

// Client calls content-service over gRPC.
type Client struct {
	client contentv1.ContentServiceClient
	conn   *grpc.ClientConn
}

// NewClient dials content-service.
func NewClient(ctx context.Context, addr string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial content grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: contentv1.NewContentServiceClient(conn),
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

func (c *Client) Ping(ctx context.Context) error {
	if c.conn == nil {
		return fmt.Errorf("no connection")
	}
	if c.conn.GetState() == connectivity.Ready {
		return nil
	}
	if !c.conn.WaitForStateChange(ctx, c.conn.GetState()) {
		return ctx.Err()
	}
	if c.conn.GetState() != connectivity.Ready {
		return fmt.Errorf("grpc not ready")
	}
	return nil
}

// GetTask loads task metadata from content-service.
func (c *Client) GetTask(ctx context.Context, taskID string) (*model.TaskSummary, error) {
	resp, err := c.client.GetTask(ctx, &contentv1.GetTaskRequest{Id: taskID})
	if err != nil {
		return nil, err
	}
	task := resp.GetTask()
	if task == nil {
		return nil, fmt.Errorf("task not found")
	}
	var meta []byte
	if task.GetMetadata() != nil {
		meta, _ = task.GetMetadata().MarshalJSON()
	}
	return &model.TaskSummary{
		ID:       task.GetId(),
		Type:     task.GetType(),
		Metadata: meta,
	}, nil
}

var _ contentadapter.Client = (*Client)(nil)
