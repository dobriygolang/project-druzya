package aigrpc

import (
	"context"
	"fmt"

	aiadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/ai"
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/connectivity"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

// Client calls ai-service over gRPC.
type Client struct {
	client aiv1.AiInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

// NewClient dials ai-service.
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

// GenerateProfileSummary requests a human-readable profile summary.
func (c *Client) GenerateProfileSummary(ctx context.Context, userID string, readiness int, skills []aiadapter.SkillScore) (string, error) {
	protoSkills := make([]*aiv1.ProfileSkillScore, 0, len(skills))
	for _, s := range skills {
		protoSkills = append(protoSkills, &aiv1.ProfileSkillScore{
			SkillKey:   s.SkillKey,
			Score:      int32(s.Score),
			Confidence: int32(s.Confidence),
		})
	}
	resp, err := c.client.GenerateProfileSummary(c.authCtx(ctx), &aiv1.GenerateProfileSummaryRequest{
		UserId:         userID,
		ReadinessScore: int32(readiness),
		Skills:         protoSkills,
	})
	if err != nil {
		return "", err
	}
	return resp.GetSummary(), nil
}

var _ aiadapter.Client = (*Client)(nil)

// Ping waits until the ai gRPC channel is ready.
func (c *Client) Ping(ctx context.Context) error {
	if c.conn == nil {
		return fmt.Errorf("no connection")
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
