package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// DismissRetryItem removes a pending retry item from the user's queue.
func (i *Implementation) DismissRetryItem(
	ctx context.Context,
	req *interviewv1.DismissRetryItemRequest,
) (*interviewv1.DismissRetryItemResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	if req.GetRetryItemId() == "" {
		return nil, invalidArgument("retry_item_id is required")
	}

	item, err := i.service.DismissRetryItem(ctx, userID, req.GetRetryItemId())
	if err != nil {
		return nil, mapServiceError(err)
	}

	return &interviewv1.DismissRetryItemResponse{Item: toProtoRetryItem(item)}, nil
}
