package sandboxapi

import (
	"context"

	sandboxservice "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/service"
	sandboxv1 "github.com/sedorofeevd/project-druzya/services/sandbox/pkg/api/sandbox/v1"
)

// RunCode executes user code in the sandbox runner.
func (i *Implementation) RunCode(ctx context.Context, req *sandboxv1.RunCodeRequest) (*sandboxv1.RunCodeResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	run, err := i.svc.RunCode(ctx, sandboxservice.RunCodeInput{
		UserID:        userID,
		TaskID:        req.TaskId,
		SessionTaskID: req.SessionTaskId,
		Language:      req.GetLanguage(),
		Code:          req.GetCode(),
		Stdin:         req.GetStdin(),
		RunType:       req.GetRunType(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &sandboxv1.RunCodeResponse{Run: toProtoCodeRun(run)}, nil
}

// GetCodeRun returns a persisted code run for the authenticated user.
func (i *Implementation) GetCodeRun(ctx context.Context, req *sandboxv1.GetCodeRunRequest) (*sandboxv1.GetCodeRunResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	run, err := i.svc.GetCodeRun(ctx, userID, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &sandboxv1.GetCodeRunResponse{Run: toProtoCodeRun(run)}, nil
}

// ListCodeRuns lists recent code runs for the authenticated user.
func (i *Implementation) ListCodeRuns(ctx context.Context, req *sandboxv1.ListCodeRunsRequest) (*sandboxv1.ListCodeRunsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	runs, err := i.svc.ListCodeRuns(ctx, userID, req.TaskId, req.SessionTaskId, int(req.GetLimit()))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*sandboxv1.CodeRun, 0, len(runs))
	for _, run := range runs {
		out = append(out, toProtoCodeRun(&run))
	}
	return &sandboxv1.ListCodeRunsResponse{Runs: out}, nil
}

// SubmitAttemptFromCodeRun submits an interview attempt using code from a prior run.
func (i *Implementation) SubmitAttemptFromCodeRun(ctx context.Context, req *sandboxv1.SubmitAttemptFromCodeRunRequest) (*sandboxv1.SubmitAttemptFromCodeRunResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	result, err := i.svc.SubmitAttemptFromCodeRun(ctx, sandboxservice.SubmitAttemptInput{
		UserID:        userID,
		BearerToken:   BearerTokenFromContext(ctx),
		CodeRunID:     req.GetId(),
		SessionTaskID: req.GetSessionTaskId(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &sandboxv1.SubmitAttemptFromCodeRunResponse{
		AttemptId: result.AttemptID,
		Status:    result.Status,
	}, nil
}
