package interviewgrpc

import (
	"context"
	"fmt"
	"strings"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/structpb"
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

// Ping waits until the interview gRPC channel is ready.
func (c *Client) Ping(ctx context.Context) error {
	if c.conn == nil {
		return fmt.Errorf("grpc not connected")
	}
	for {
		state := c.conn.GetState()
		if state == connectivity.Ready {
			return nil
		}
		if !c.conn.WaitForStateChange(ctx, state) {
			return ctx.Err()
		}
	}
}

func (c *Client) GetAttempt(ctx context.Context, attemptID string) (*interviewadapter.Attempt, error) {
	resp, err := c.client.GetAttemptInternal(c.authCtx(ctx), &interviewv1.GetAttemptInternalRequest{
		AttemptId: attemptID,
	})
	if err != nil {
		return nil, interviewadapter.MapGRPCError(err)
	}
	return fromProtoAttempt(resp.GetAttempt())
}

func (c *Client) CompleteEvaluation(ctx context.Context, input interviewadapter.CompleteEvaluationInput) error {
	feedback, err := structpb.NewStruct(input.Feedback)
	if err != nil {
		feedback = &structpb.Struct{}
	}
	_, err = c.client.CompleteEvaluation(c.authCtx(ctx), &interviewv1.CompleteEvaluationRequest{
		AttemptId: input.AttemptID,
		Score:     input.Score,
		Passed:    input.Passed,
		Summary:   input.Summary,
		Feedback:  feedback,
	})
	if err != nil {
		return interviewadapter.MapGRPCError(err)
	}
	return nil
}

func (c *Client) FailEvaluation(ctx context.Context, attemptID string, reason *string) error {
	_, err := c.client.FailEvaluation(c.authCtx(ctx), &interviewv1.FailEvaluationRequest{
		AttemptId: attemptID,
		Reason:    reason,
	})
	if err != nil {
		return interviewadapter.MapGRPCError(err)
	}
	return nil
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
			ID:        ev.GetId(),
			EventName: ev.GetEventName(),
			Payload:   payload,
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

func fromProtoAttempt(a *interviewv1.Attempt) (*interviewadapter.Attempt, error) {
	if a == nil {
		return nil, fmt.Errorf("attempt not found")
	}
	var attachments []byte
	if a.GetAttachments() != nil {
		raw, err := a.GetAttachments().MarshalJSON()
		if err != nil {
			return nil, err
		}
		attachments = raw
	}
	return &interviewadapter.Attempt{
		ID:            a.GetId(),
		UserID:        a.GetUserId(),
		SessionTaskID: a.GetSessionTaskId(),
		TaskID:        a.GetTaskId(),
		AnswerText:    a.AnswerText,
		Code:          a.Code,
		Language:      a.Language,
		Attachments:   attachments,
		Status:        strings.ToLower(a.GetStatus().String()),
	}, nil
}

var _ interviewadapter.Client = (*Client)(nil)
