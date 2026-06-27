package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// GetTaskBundle returns task, solutions and rubric for ai evaluation.
func (i *Implementation) GetTaskBundle(ctx context.Context, req *contentv1.GetTaskBundleRequest) (*contentv1.GetTaskBundleResponse, error) {
	if req.GetTaskId() == "" {
		return nil, invalidArgument("task_id is required")
	}

	bundle, err := i.service.GetTaskBundle(ctx, req.GetTaskId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoTaskBundle(bundle)
}
