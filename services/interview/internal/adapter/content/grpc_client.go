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

func (c *GRPCClient) GetInterviewTemplateDetail(ctx context.Context, templateID string) (*TemplateDetail, error) {
	resp, err := c.client.GetInterviewTemplateDetail(ctx, &contentv1.GetInterviewTemplateDetailRequest{Id: templateID})
	if err != nil {
		return nil, mapGRPCError(err)
	}
	if resp.GetTemplate() == nil {
		return nil, fmt.Errorf("template not found")
	}

	sections := make([]TemplateSection, 0, len(resp.GetSections()))
	for _, sec := range resp.GetSections() {
		var passing *int
		if sec.PassingScore != nil {
			v := int(sec.GetPassingScore())
			passing = &v
		}
		sections = append(sections, TemplateSection{
			SectionType:  sec.GetSectionType(),
			Title:        sec.GetTitle(),
			Position:     int(sec.GetPosition()),
			PassingScore: passing,
			TaskIDs:      sec.GetTaskIds(),
		})
	}

	return &TemplateDetail{
		TemplateID:   resp.GetTemplate().GetId(),
		PassingScore: int(resp.GetTemplate().GetPassingScore()),
		Sections:     sections,
	}, nil
}

func (c *GRPCClient) GetTask(ctx context.Context, taskID string) (*Task, error) {
	resp, err := c.client.GetTask(ctx, &contentv1.GetTaskRequest{Id: taskID})
	if err != nil {
		return nil, mapGRPCError(err)
	}
	t := resp.GetTask()
	if t == nil {
		return nil, fmt.Errorf("task not found")
	}
	return &Task{
		ID:     t.GetId(),
		Slug:   t.GetSlug(),
		Type:   t.GetType(),
		Title:  t.GetTitle(),
		Status: t.GetStatus(),
	}, nil
}

func (c *GRPCClient) ListTasks(ctx context.Context, taskType string, limit int) ([]Task, error) {
	status := "published"
	resp, err := c.client.ListTasks(ctx, &contentv1.ListTasksRequest{
		Type:   &taskType,
		Status: &status,
		Limit:  int32(limit),
	})
	if err != nil {
		return nil, mapGRPCError(err)
	}

	items := make([]Task, 0, len(resp.GetTasks()))
	for _, t := range resp.GetTasks() {
		items = append(items, Task{
			ID:     t.GetId(),
			Slug:   t.GetSlug(),
			Type:   t.GetType(),
			Title:  t.GetTitle(),
			Status: t.GetStatus(),
		})
	}
	return items, nil
}
