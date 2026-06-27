package interviewgrpc

import (
	"context"
	"fmt"

	interviewadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/interview"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

// Client calls interview-service user API with forwarded JWT.
type Client struct {
	client interviewv1.InterviewServiceClient
	conn   *grpc.ClientConn
}

// NewClient dials interview-service.
func NewClient(ctx context.Context, addr string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial interview grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		client: interviewv1.NewInterviewServiceClient(conn),
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

func userCtx(ctx context.Context, bearerToken string) context.Context {
	if bearerToken == "" {
		return ctx
	}
	return metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+bearerToken)
}

// SubmitAttempt forwards the user's bearer token to interview-service.
func (c *Client) SubmitAttempt(ctx context.Context, bearerToken string, input interviewadapter.SubmitAttemptInput) (*interviewadapter.SubmitAttemptResult, error) {
	req := &interviewv1.SubmitAttemptRequest{SessionTaskId: input.SessionTaskID}
	if input.AnswerText != nil {
		req.AnswerText = input.AnswerText
	}
	if input.Code != nil {
		req.Code = input.Code
	}
	if input.Language != nil {
		req.Language = input.Language
	}
	resp, err := c.client.SubmitAttempt(userCtx(ctx, bearerToken), req)
	if err != nil {
		return nil, err
	}
	attempt := resp.GetAttempt()
	if attempt == nil {
		return nil, fmt.Errorf("empty attempt response")
	}
	return &interviewadapter.SubmitAttemptResult{
		AttemptID: attempt.GetId(),
		Status:    attempt.GetStatus().String(),
	}, nil
}

var _ interviewadapter.Client = (*Client)(nil)
