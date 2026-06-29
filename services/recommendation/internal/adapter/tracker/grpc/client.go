package trackergrpc

import (
	"context"
	"fmt"

	trackeradapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/tracker"
	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/structpb"
)

const internalTokenHeader = "x-internal-token"

type Client struct {
	client trackerv1.TrackerInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

func NewClient(ctx context.Context, addr, token string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial tracker grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: trackerv1.NewTrackerInternalServiceClient(conn),
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
	_, err := c.client.ClaimOutboxEvents(c.authCtx(ctx), &trackerv1.ClaimOutboxEventsRequest{Limit: 0})
	return err
}

func (c *Client) ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]trackeradapter.OutboxEvent, error) {
	req := &trackerv1.ClaimOutboxEventsRequest{Limit: int32(limit)}
	if eventName != "" {
		req.EventName = &eventName
	}
	resp, err := c.client.ClaimOutboxEvents(c.authCtx(ctx), req)
	if err != nil {
		return nil, err
	}
	out := make([]trackeradapter.OutboxEvent, 0, len(resp.GetEvents()))
	for _, ev := range resp.GetEvents() {
		payload := map[string]any{}
		if ev.GetPayload() != nil {
			payload = ev.GetPayload().AsMap()
		}
		out = append(out, trackeradapter.OutboxEvent{
			ID: ev.GetId(), EventName: ev.GetEventName(), Payload: payload,
			OccurredAt: ev.GetOccurredAt().AsTime(),
		})
	}
	return out, nil
}

func (c *Client) AckOutboxEvents(ctx context.Context, ids []string) error {
	_, err := c.client.AckOutboxEvents(c.authCtx(ctx), &trackerv1.AckOutboxEventsRequest{EventIds: ids})
	return err
}

func (c *Client) FailOutboxEvent(ctx context.Context, id, errMsg string) error {
	_, err := c.client.FailOutboxEvent(c.authCtx(ctx), &trackerv1.FailOutboxEventRequest{EventId: id, Error: errMsg})
	return err
}

func (c *Client) EnsureLearningBoard(ctx context.Context, userID string) error {
	_, err := c.client.EnsureLearningBoard(c.authCtx(ctx), &trackerv1.EnsureLearningBoardRequest{UserId: userID})
	return err
}

func (c *Client) CreateTaskInternal(ctx context.Context, params trackeradapter.CreateTaskParams) (bool, error) {
	meta, err := structpb.NewStruct(params.Metadata)
	if err != nil {
		return false, err
	}
	source := trackerv1.TaskSource_TASK_SOURCE_RECOMMENDATION
	switch params.Source {
	case "user":
		source = trackerv1.TaskSource_TASK_SOURCE_USER
	case "enrichment":
		source = trackerv1.TaskSource_TASK_SOURCE_ENRICHMENT
	}
	resp, err := c.client.CreateTaskInternal(c.authCtx(ctx), &trackerv1.CreateTaskInternalRequest{
		UserId: params.UserID, Title: params.Title, Source: source, Metadata: meta,
		DedupKey: params.DedupKey, EpicName: params.EpicName, EstimateDays: float32Ptr(params.EstimateDays),
	})
	if err != nil {
		return false, err
	}
	return resp.GetCreated(), nil
}

func (c *Client) GetUserSettings(ctx context.Context, userID string) (*trackeradapter.UserSettings, error) {
	resp, err := c.client.GetUserSettings(c.authCtx(ctx), &trackerv1.GetUserSettingsRequest{UserId: userID})
	if err != nil {
		return nil, err
	}
	s := resp.GetSettings()
	return &trackeradapter.UserSettings{
		SmartParseEnabled:         s.GetSmartParseEnabled(),
		GoogleCalendarSyncEnabled: s.GetGoogleCalendarSyncEnabled(),
		GoogleCalendarConnected:   s.GetGoogleCalendarConnected(),
		DeferredSprintEpicNames:   append([]string{}, s.GetDeferredSprintEpicNames()...),
	}, nil
}

func (c *Client) PatchTaskMetadata(ctx context.Context, userID, taskID string, metadata map[string]any) error {
	meta, err := structpb.NewStruct(metadata)
	if err != nil {
		return err
	}
	_, err = c.client.PatchTaskMetadata(c.authCtx(ctx), &trackerv1.PatchTaskMetadataRequest{
		UserId: userID, TaskId: taskID, Metadata: meta,
	})
	return err
}

func float32Ptr(v *float64) *float32 {
	if v == nil {
		return nil
	}
	out := float32(*v)
	return &out
}

var _ trackeradapter.Client = (*Client)(nil)
