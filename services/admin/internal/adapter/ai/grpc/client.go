package aigrpc

import (
	"context"
	"fmt"

	aiadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/ai"
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalTokenHeader = "x-internal-token"

// Client calls ai-service internal gRPC APIs.
type Client struct {
	internal aiv1.AiInternalServiceClient
	conn     *grpc.ClientConn
	token    string
}

// NewClient dials ai-service gRPC endpoint.
func NewClient(ctx context.Context, addr, internalToken string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial ai grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		internal: aiv1.NewAiInternalServiceClient(conn),
		conn:     conn,
		token:    internalToken,
	}, nil
}

// Close releases the gRPC connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) internalCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, internalTokenHeader, c.token)
}

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.internal.ListEvaluationJobs(c.internalCtx(ctx), &aiv1.ListEvaluationJobsRequest{Limit: 1})
	return err
}

func (c *Client) ListEvaluationJobs(ctx context.Context, status *aiadapter.EvaluationJobStatus, limit int) ([]aiadapter.EvaluationJob, error) {
	req := &aiv1.ListEvaluationJobsRequest{Limit: int32(limit)}
	if status != nil {
		req.Status = jobStatusToProto(*status)
	}
	resp, err := c.internal.ListEvaluationJobs(c.internalCtx(ctx), req)
	if err != nil {
		return nil, aiadapter.MapGRPCError(err)
	}
	out := make([]aiadapter.EvaluationJob, 0, len(resp.GetJobs()))
	for _, item := range resp.GetJobs() {
		out = append(out, fromProtoJob(item))
	}
	return out, nil
}

func (c *Client) GetEvaluationJob(ctx context.Context, id string) (*aiadapter.EvaluationJob, error) {
	resp, err := c.internal.GetEvaluationJob(c.internalCtx(ctx), &aiv1.GetEvaluationJobRequest{Id: id})
	if err != nil {
		return nil, aiadapter.MapGRPCError(err)
	}
	job := fromProtoJob(resp)
	return &job, nil
}

func (c *Client) GetLLMConfig(ctx context.Context) (*aiadapter.LLMRuntimeConfig, error) {
	resp, err := c.internal.GetLLMConfig(c.internalCtx(ctx), &aiv1.GetLLMConfigRequest{})
	if err != nil {
		return nil, aiadapter.MapGRPCError(err)
	}
	cfg := fromProtoLLMConfig(resp.GetConfig())
	return &cfg, nil
}

func (c *Client) UpdateLLMConfig(ctx context.Context, input aiadapter.UpdateLLMConfigInput) (*aiadapter.LLMRuntimeConfig, error) {
	resp, err := c.internal.UpdateLLMConfig(c.internalCtx(ctx), &aiv1.UpdateLLMConfigRequest{
		ExpectedVersion:   input.ExpectedVersion,
		ChainOrder:        input.ChainOrder,
		TaskMapJson:       input.TaskMapJSON,
		VirtualChainsJson: input.VirtualChainsJSON,
	})
	if err != nil {
		return nil, aiadapter.MapGRPCError(err)
	}
	cfg := fromProtoLLMConfig(resp.GetConfig())
	return &cfg, nil
}

func fromProtoJob(j *aiv1.EvaluationJob) aiadapter.EvaluationJob {
	if j == nil {
		return aiadapter.EvaluationJob{}
	}
	out := aiadapter.EvaluationJob{
		ID:         j.GetId(),
		AttemptID:  j.GetAttemptId(),
		UserID:     j.GetUserId(),
		TaskID:     j.GetTaskId(),
		Status:     jobStatusFromProto(j.GetStatus()),
		RetryCount: int(j.GetRetryCount()),
		Retryable:  j.GetRetryable(),
		Error:      j.Error,
		CreatedAt:  j.GetCreatedAt().AsTime(),
		UpdatedAt:  j.GetUpdatedAt().AsTime(),
	}
	if j.NextRetryAt != nil {
		t := j.GetNextRetryAt().AsTime()
		out.NextRetryAt = &t
	}
	if j.StartedAt != nil {
		t := j.GetStartedAt().AsTime()
		out.StartedAt = &t
	}
	if j.CompletedAt != nil {
		t := j.GetCompletedAt().AsTime()
		out.CompletedAt = &t
	}
	return out
}

func fromProtoLLMConfig(c *aiv1.LLMRuntimeConfig) aiadapter.LLMRuntimeConfig {
	if c == nil {
		return aiadapter.LLMRuntimeConfig{}
	}
	return aiadapter.LLMRuntimeConfig{
		Version:           c.GetVersion(),
		ChainOrder:        append([]string(nil), c.GetChainOrder()...),
		TaskMapJSON:       c.GetTaskMapJson(),
		VirtualChainsJSON: c.GetVirtualChainsJson(),
	}
}

func jobStatusFromProto(s aiv1.EvaluationJobStatus) aiadapter.EvaluationJobStatus {
	switch s {
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_PENDING:
		return aiadapter.JobStatusPending
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_RUNNING:
		return aiadapter.JobStatusRunning
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_COMPLETED:
		return aiadapter.JobStatusCompleted
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_FAILED:
		return aiadapter.JobStatusFailed
	default:
		return ""
	}
}

func jobStatusToProto(s aiadapter.EvaluationJobStatus) *aiv1.EvaluationJobStatus {
	var out aiv1.EvaluationJobStatus
	switch s {
	case aiadapter.JobStatusPending:
		out = aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_PENDING
	case aiadapter.JobStatusRunning:
		out = aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_RUNNING
	case aiadapter.JobStatusCompleted:
		out = aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_COMPLETED
	case aiadapter.JobStatusFailed:
		out = aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_FAILED
	default:
		return nil
	}
	return &out
}

var _ aiadapter.Client = (*Client)(nil)

func (c *Client) ProbeLLMProviders(ctx context.Context) ([]aiadapter.LLMProviderProbe, error) {
	resp, err := c.internal.ProbeLLMProviders(c.internalCtx(ctx), &aiv1.ProbeLLMProvidersRequest{})
	if err != nil {
		return nil, aiadapter.MapGRPCError(err)
	}
	out := make([]aiadapter.LLMProviderProbe, 0, len(resp.GetProbes()))
	for _, item := range resp.GetProbes() {
		probe := aiadapter.LLMProviderProbe{
			Provider:   item.GetProvider(),
			Model:      item.GetModel(),
			Registered: item.GetRegistered(),
			OK:         item.GetOk(),
			LatencyMs:  item.GetLatencyMs(),
		}
		if item.Error != nil {
			probe.Error = item.GetError()
		}
		out = append(out, probe)
	}
	return out, nil
}

func (c *Client) GetOpsStats(ctx context.Context) (*aiadapter.OpsStats, error) {
	resp, err := c.internal.GetOpsStats(c.internalCtx(ctx), &aiv1.GetOpsStatsRequest{})
	if err != nil {
		return nil, aiadapter.MapGRPCError(err)
	}
	return &aiadapter.OpsStats{
		ServiceName:       resp.GetServiceName(),
		DatabaseName:      resp.GetDatabaseName(),
		DatabaseSizeBytes: resp.GetDatabaseSizeBytes(),
		MemoryAllocBytes:  resp.GetMemoryAllocBytes(),
		MemorySysBytes:    resp.GetMemorySysBytes(),
		Goroutines:        int(resp.GetGoroutines()),
		HTTPRPS:           resp.GetHttpRps(),
	}, nil
}
