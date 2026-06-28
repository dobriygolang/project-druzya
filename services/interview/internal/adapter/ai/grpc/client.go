package aigrpc

import (
	"context"
	"fmt"

	aiadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/ai"
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/structpb"
)

const internalTokenHeader = "x-internal-token"

// Client dials ai-service internal gRPC.
type Client struct {
	client aiv1.AiInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

// NewClient connects to ai-service.
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

// Close releases the connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) authCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, internalTokenHeader, c.token)
}

func (c *Client) RunSystemDesignInterviewerTurn(ctx context.Context, in aiadapter.InterviewerTurnInput) (*aiadapter.InterviewerTurnOutput, error) {
	turns := make([]*aiv1.SystemDesignTurnMessage, 0, len(in.Turns))
	for _, t := range in.Turns {
		turns = append(turns, &aiv1.SystemDesignTurnMessage{
			Role:    t.Role,
			Content: t.Content,
			Phase:   t.Phase,
		})
	}
	snap, err := structpb.NewStruct(in.WorkspaceSnapshot)
	if err != nil {
		snap, _ = structpb.NewStruct(map[string]any{})
	}
	req := &aiv1.RunSystemDesignInterviewerTurnRequest{
		UserId:            in.UserID,
		TaskId:            in.TaskID,
		Phase:             in.Phase,
		Turns:             turns,
		WorkspaceSnapshot: snap,
	}
	if in.TaskTitle != "" {
		req.TaskTitle = &in.TaskTitle
	}
	if in.TaskDescription != "" {
		req.TaskDescription = &in.TaskDescription
	}
	resp, err := c.client.RunSystemDesignInterviewerTurn(c.authCtx(ctx), req)
	if err != nil {
		return nil, err
	}
	out := &aiadapter.InterviewerTurnOutput{
		Reply:    resp.GetReply(),
		Metadata: resp.GetMetadata().AsMap(),
	}
	if sp := resp.SuggestedPhase; sp != nil && *sp != "" {
		out.SuggestedPhase = sp
	}
	return out, nil
}

func (c *Client) RunSystemDesignCheckpoint(ctx context.Context, in aiadapter.CheckpointInput) (*aiadapter.CheckpointOutput, error) {
	snap, err := structpb.NewStruct(in.WorkspaceSnapshot)
	if err != nil {
		snap, _ = structpb.NewStruct(map[string]any{})
	}
	req := &aiv1.RunSystemDesignCheckpointRequest{
		UserId:            in.UserID,
		TaskId:            in.TaskID,
		Phase:             in.Phase,
		WorkspaceSnapshot: snap,
	}
	if in.DiagramPNGBase64 != nil {
		req.DiagramPngBase64 = in.DiagramPNGBase64
	}
	if in.TaskTitle != "" {
		req.TaskTitle = &in.TaskTitle
	}
	if in.TaskDescription != "" {
		req.TaskDescription = &in.TaskDescription
	}
	resp, err := c.client.RunSystemDesignCheckpoint(c.authCtx(ctx), req)
	if err != nil {
		return nil, err
	}
	return &aiadapter.CheckpointOutput{
		Critique: resp.GetCritique(),
		Metadata: resp.GetMetadata().AsMap(),
	}, nil
}

var _ aiadapter.Client = (*Client)(nil)
