package recommendationgrpc

import (
	"context"
	"fmt"

	recommendationadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/recommendation"
	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const internalTokenHeader = "x-internal-token"

type Client struct {
	client recommendationv1.RecommendationInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

func NewClient(ctx context.Context, addr, token string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial recommendation grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: recommendationv1.NewRecommendationInternalServiceClient(conn),
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
	return nil
}

func (c *Client) ReconcileUserPlan(ctx context.Context, userID, localDate, timezone string) error {
	req := &recommendationv1.ReconcileUserPlanRequest{UserId: userID}
	if localDate != "" {
		req.LocalDate = &localDate
	}
	if timezone != "" {
		req.Timezone = &timezone
	}
	_, err := c.client.ReconcileUserPlan(c.authCtx(ctx), req)
	return err
}

func (c *Client) PlanToday(ctx context.Context, userID, localDate, timezone string, tasks []recommendationadapter.PlanTaskInput) (*recommendationadapter.TodayPlan, error) {
	protoTasks := make([]*recommendationv1.PlanTodayTaskInput, 0, len(tasks))
	for _, t := range tasks {
		meta, err := structpb.NewStruct(t.Metadata)
		if err != nil {
			meta = &structpb.Struct{}
		}
		item := &recommendationv1.PlanTodayTaskInput{
			Id: t.ID, Title: t.Title, EstimateDays: float32(t.EstimateDays),
			Position: int32(t.Position), Source: t.Source, Metadata: meta,
			CreatedAt: timestamppb.New(t.CreatedAt),
		}
		if t.EpicID != "" {
			item.EpicId = &t.EpicID
		}
		protoTasks = append(protoTasks, item)
	}
	req := &recommendationv1.PlanTodayRequest{UserId: userID, Tasks: protoTasks}
	if localDate != "" {
		req.LocalDate = &localDate
	}
	if timezone != "" {
		req.Timezone = &timezone
	}
	resp, err := c.client.PlanToday(c.authCtx(ctx), req)
	if err != nil {
		return nil, err
	}
	meta := map[string]recommendationadapter.PlanTaskMeta{}
	for _, m := range resp.GetTaskMeta() {
		meta[m.GetTaskId()] = recommendationadapter.PlanTaskMeta{
			TaskID: m.GetTaskId(), ReasonCode: m.GetReasonCode(), Score: m.GetScore(),
		}
	}
	return &recommendationadapter.TodayPlan{
		TodayTaskIDs:   resp.GetTodayTaskIds(),
		LaterTaskIDs:   resp.GetLaterTaskIds(),
		BudgetUsed:     float64(resp.GetBudgetUsed()),
		BudgetCapacity: float64(resp.GetBudgetCapacity()),
		LocalDate:      resp.GetLocalDate(),
		TaskMeta:       meta,
	}, nil
}

var _ recommendationadapter.Client = (*Client)(nil)
