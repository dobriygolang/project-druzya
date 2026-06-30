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
		UserID:   userID,
		Language: req.GetLanguage(),
		Code:     req.GetCode(),
		Stdin:    req.GetStdin(),
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
