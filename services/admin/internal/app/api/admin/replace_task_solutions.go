package adminapi

import (
	"context"

	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ReplaceTaskSolutions replaces all reference solutions for a task.
func (i *Implementation) ReplaceTaskSolutions(ctx context.Context, req *adminv1.ReplaceTaskSolutionsRequest) (*adminv1.ReplaceTaskSolutionsResponse, error) {
	inputs := make([]contentadapter.SolutionInput, 0, len(req.GetSolutions()))
	for _, item := range req.GetSolutions() {
		inputs = append(inputs, contentadapter.SolutionInput{
			ID:           optionalString(item.Id),
			Language:     item.Language,
			SolutionText: item.GetSolutionText(),
			Explanation:  item.Explanation,
			Complexity:   item.Complexity,
			IsPrimary:    item.GetIsPrimary(),
		})
	}
	solutions, err := i.service.ReplaceTaskSolutions(ctx, req.GetTaskId(), inputs)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make([]*adminv1.TaskSolution, 0, len(solutions))
	for _, sol := range solutions {
		out = append(out, toProtoSolution(sol))
	}
	return &adminv1.ReplaceTaskSolutionsResponse{Solutions: out}, nil
}
