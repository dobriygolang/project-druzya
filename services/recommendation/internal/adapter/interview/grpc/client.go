package interviewgrpc

import (
	"context"
	"fmt"
	"strconv"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"github.com/shopspring/decimal"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

// Client calls interview-service internal API.
type Client struct {
	client interviewv1.InterviewInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

// NewClient dials interview-service gRPC endpoint.
func NewClient(ctx context.Context, addr, token string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial interview grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: interviewv1.NewInterviewInternalServiceClient(conn),
		conn:   conn,
		token:  token,
	}, nil
}

// Close releases the gRPC connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) authCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, internalTokenHeader, c.token)
}

// Ping verifies interview-service internal API is reachable.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.client.ClaimOutboxEvents(c.authCtx(ctx), &interviewv1.ClaimOutboxEventsRequest{Limit: 0})
	return err
}

func (c *Client) ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]interviewadapter.OutboxEvent, error) {
	req := &interviewv1.ClaimOutboxEventsRequest{Limit: int32(limit)}
	if eventName != "" {
		req.EventName = &eventName
	}
	resp, err := c.client.ClaimOutboxEvents(c.authCtx(ctx), req)
	if err != nil {
		return nil, interviewadapter.MapGRPCError(err)
	}
	out := make([]interviewadapter.OutboxEvent, 0, len(resp.GetEvents()))
	for _, ev := range resp.GetEvents() {
		payload := map[string]any{}
		if ev.GetPayload() != nil {
			payload = ev.GetPayload().AsMap()
		}
		out = append(out, interviewadapter.OutboxEvent{
			ID:         ev.GetId(),
			EventName:  ev.GetEventName(),
			Payload:    payload,
			OccurredAt: ev.GetOccurredAt().AsTime(),
		})
	}
	return out, nil
}

func (c *Client) AckOutboxEvents(ctx context.Context, ids []string) error {
	_, err := c.client.AckOutboxEvents(c.authCtx(ctx), &interviewv1.AckOutboxEventsRequest{EventIds: ids})
	if err != nil {
		return interviewadapter.MapGRPCError(err)
	}
	return nil
}

func (c *Client) FailOutboxEvent(ctx context.Context, id, errMsg string) error {
	_, err := c.client.FailOutboxEvent(c.authCtx(ctx), &interviewv1.FailOutboxEventRequest{
		EventId: id,
		Error:   errMsg,
	})
	if err != nil {
		return interviewadapter.MapGRPCError(err)
	}
	return nil
}

func (c *Client) GetEvaluationSummary(ctx context.Context, attemptID string) (*interviewadapter.EvaluationSummary, error) {
	resp, err := c.client.GetEvaluationSummaryInternal(c.authCtx(ctx), &interviewv1.GetEvaluationSummaryInternalRequest{
		AttemptId: attemptID,
	})
	if err != nil {
		return nil, interviewadapter.MapGRPCError(err)
	}
	summary := resp.GetSummary()
	if summary == nil {
		return nil, interviewadapter.ErrNotFound
	}

	score, err := parseScore(summary.GetScore())
	if err != nil {
		return nil, err
	}

	feedback := map[string]any{}
	if summary.GetFeedback() != nil {
		feedback = summary.GetFeedback().AsMap()
	}

	var createdAt = summary.GetCreatedAt().AsTime()

	return &interviewadapter.EvaluationSummary{
		AttemptID: summary.GetAttemptId(),
		Score:     score,
		Passed:    summary.GetPassed(),
		Feedback:  feedback,
		CreatedAt: createdAt,
	}, nil
}

func (c *Client) ListPendingRetryItems(ctx context.Context, userID string) ([]interviewadapter.RetryItem, error) {
	status := interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_PENDING
	resp, err := c.client.ListRetryItemsInternal(c.authCtx(ctx), &interviewv1.ListRetryItemsInternalRequest{
		UserId: userID,
		Status: &status,
	})
	if err != nil {
		return nil, interviewadapter.MapGRPCError(err)
	}

	out := make([]interviewadapter.RetryItem, 0, len(resp.GetItems()))
	for _, item := range resp.GetItems() {
		out = append(out, interviewadapter.RetryItem{
			ID:     item.GetId(),
			UserID: item.GetUserId(),
			TaskID: item.GetTaskId(),
			Status: item.GetStatus().String(),
		})
	}
	return out, nil
}

func (c *Client) CompleteRetryItem(ctx context.Context, userID, retryItemID string) (*interviewadapter.RetryItem, error) {
	resp, err := c.client.CompleteRetryItemInternal(c.authCtx(ctx), &interviewv1.CompleteRetryItemInternalRequest{
		UserId:      userID,
		RetryItemId: retryItemID,
	})
	if err != nil {
		return nil, interviewadapter.MapGRPCError(err)
	}
	item := resp.GetItem()
	if item == nil {
		return nil, interviewadapter.ErrNotFound
	}
	return &interviewadapter.RetryItem{
		ID:     item.GetId(),
		UserID: item.GetUserId(),
		TaskID: item.GetTaskId(),
		Status: item.GetStatus().String(),
	}, nil
}

func parseScore(raw string) (float64, error) {
	if raw == "" {
		return 0, nil
	}
	d, err := decimal.NewFromString(raw)
	if err != nil {
		f, convErr := strconv.ParseFloat(raw, 64)
		if convErr != nil {
			return 0, fmt.Errorf("parse score %q: %w", raw, err)
		}
		return f, nil
	}
	f, _ := d.Float64()
	return f, nil
}

var _ interviewadapter.Client = (*Client)(nil)
