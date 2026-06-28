package content

import (
	"context"
	"fmt"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// GRPCClient calls content-service over gRPC.
type GRPCClient struct {
	client contentv1.ContentServiceClient
	conn   *grpc.ClientConn
}

// NewGRPCClient dials content-service gRPC endpoint.
func NewGRPCClient(ctx context.Context, addr string) (*GRPCClient, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial content grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &GRPCClient{
		client: contentv1.NewContentServiceClient(conn),
		conn:   conn,
	}, nil
}

// Close releases the gRPC connection.
func (c *GRPCClient) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

// Ping verifies content-service is reachable.
func (c *GRPCClient) Ping(ctx context.Context) error {
	limit := int32(1)
	_, err := c.client.ListCompanies(ctx, &contentv1.ListCompaniesRequest{Limit: limit})
	return err
}

func (c *GRPCClient) GetTask(ctx context.Context, taskID string) (*Task, error) {
	resp, err := c.client.GetTask(ctx, &contentv1.GetTaskRequest{Id: taskID})
	if err != nil {
		return nil, MapGRPCError(err)
	}
	t := resp.GetTask()
	if t == nil {
		return nil, ErrNotFound
	}
	return &Task{
		ID:     t.GetId(),
		Slug:   t.GetSlug(),
		Type:   t.GetType(),
		Title:  t.GetTitle(),
		Status: t.GetStatus(),
	}, nil
}

func (c *GRPCClient) ListArticlesBySkillKeys(ctx context.Context, skillKeys []string) ([]Article, error) {
	if len(skillKeys) == 0 {
		return nil, nil
	}
	resp, err := c.client.ListArticles(ctx, &contentv1.ListArticlesRequest{
		SkillKeys: skillKeys,
	})
	if err != nil {
		return nil, MapGRPCError(err)
	}

	out := make([]Article, 0, len(resp.GetArticles()))
	for _, summary := range resp.GetArticles() {
		if summary == nil {
			continue
		}
		out = append(out, Article{
			ID:        summary.GetId(),
			Slug:      summary.GetSlug(),
			Title:     summary.GetTitle(),
			Summary:   summary.GetSummary(),
			SkillKeys: summary.GetSkillKeys(),
		})
	}
	return out, nil
}

var _ Client = (*GRPCClient)(nil)
