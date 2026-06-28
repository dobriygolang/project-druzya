package recommendationgrpc

import (
	"context"
	"fmt"

	recommendationadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/recommendation"
	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

// Client calls recommendation-service internal RPCs.
type Client struct {
	client recommendationv1.RecommendationInternalServiceClient
	conn   *grpc.ClientConn
	token  string
}

// NewClient dials recommendation-service.
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

func (c *Client) GetTaskPickerHints(ctx context.Context, userID, taskType string) ([]string, []recommendationadapter.ReviewCandidate, error) {
	resp, err := c.client.GetTaskPickerHints(c.authCtx(ctx), &recommendationv1.GetTaskPickerHintsRequest{
		UserId:   userID,
		TaskType: taskType,
	})
	if err != nil {
		return nil, nil, err
	}

	passed := append([]string(nil), resp.GetPassedTaskIds()...)
	review := make([]recommendationadapter.ReviewCandidate, 0, len(resp.GetReviewCandidates()))
	for _, item := range resp.GetReviewCandidates() {
		if item == nil || item.GetTaskId() == "" {
			continue
		}
		review = append(review, recommendationadapter.ReviewCandidate{
			TaskID:    item.GetTaskId(),
			TaskType:  item.GetTaskType(),
			BestScore: int(item.GetBestScore()),
		})
	}
	return passed, review, nil
}

var _ recommendationadapter.Client = (*Client)(nil)
