package contentgrpc

import (
	"context"
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/content"
	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Client calls content-service over gRPC.
type Client struct {
	client contentv1.ContentServiceClient
	conn   *grpc.ClientConn
}

// NewClient dials content-service gRPC endpoint.
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

// Close releases the gRPC connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) GetTaskBundle(ctx context.Context, taskID string) (*contentadapter.TaskBundle, error) {
	resp, err := c.client.GetTaskBundle(ctx, &contentv1.GetTaskBundleRequest{TaskId: taskID})
	if err != nil {
		return nil, contentadapter.MapGRPCError(err)
	}
	if resp.GetTask() == nil {
		return nil, fmt.Errorf("task not found")
	}
	t := resp.GetTask()
	bundle := &contentadapter.TaskBundle{
		Task: &contentadapter.Task{
			ID:          t.GetId(),
			Slug:        t.GetSlug(),
			Type:        t.GetType(),
			Title:       t.GetTitle(),
			Description: t.GetDescription(),
			Difficulty:  t.GetDifficulty(),
			Status:      t.GetStatus(),
		},
	}
	for _, sol := range resp.GetSolutions() {
		bundle.Solutions = append(bundle.Solutions, contentadapter.Solution{
			Language:     sol.Language,
			SolutionText: sol.GetSolutionText(),
			Explanation:  sol.Explanation,
			Complexity:   sol.Complexity,
			IsPrimary:    sol.GetIsPrimary(),
		})
	}
	if r := resp.GetRubric(); r != nil {
		bundle.Rubric = &contentadapter.Rubric{
			ID:       r.GetId(),
			TaskType: r.GetTaskType(),
			Title:    r.GetTitle(),
			Version:  int(r.GetVersion()),
		}
		for _, crit := range r.GetCriteria() {
			bundle.Criteria = append(bundle.Criteria, contentadapter.RubricCriterion{
				Key:         crit.GetKey(),
				Title:       crit.GetTitle(),
				Description: crit.Description,
				Weight:      int(crit.GetWeight()),
				MaxScore:    int(crit.GetMaxScore()),
				Position:    int(crit.GetPosition()),
			})
		}
	}
	return bundle, nil
}

var _ contentadapter.Client = (*Client)(nil)
