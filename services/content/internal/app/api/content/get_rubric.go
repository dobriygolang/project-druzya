package contentapi

import (
	"context"

	contentv1 "github.com/sedorofeevd/project-druzya/services/content/pkg/api/content/v1"
)

// GetRubric returns rubric by id.
func (i *Implementation) GetRubric(ctx context.Context, req *contentv1.GetRubricRequest) (*contentv1.GetRubricResponse, error) {
	if req.GetId() == "" {
		return nil, invalidArgument("id is required")
	}

	rubric, criteria, err := i.service.GetRubric(ctx, req.GetId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &contentv1.GetRubricResponse{Rubric: toProtoRubric(rubric, criteria)}, nil
}
