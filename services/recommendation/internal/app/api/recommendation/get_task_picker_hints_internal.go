package recommendationapi

import (
	"context"

	recommendationv1 "github.com/sedorofeevd/project-druzya/services/recommendation/pkg/api/recommendation/v1"
)

// GetTaskPickerHints returns passed and review task hints for interview task selection.
func (i *Implementation) GetTaskPickerHints(ctx context.Context, req *recommendationv1.GetTaskPickerHintsRequest) (*recommendationv1.GetTaskPickerHintsResponse, error) {
	if req.GetUserId() == "" || req.GetTaskType() == "" {
		return nil, invalidArgument("user_id and task_type are required")
	}
	hints, err := i.service.GetTaskPickerHints(ctx, req.GetUserId(), req.GetTaskType())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoTaskPickerHints(hints), nil
}
