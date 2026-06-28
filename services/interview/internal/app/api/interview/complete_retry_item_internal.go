package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// CompleteRetryItemInternal marks a retry queue item completed (internal RPC).
func (i *Implementation) CompleteRetryItemInternal(
	ctx context.Context,
	req *interviewv1.CompleteRetryItemInternalRequest,
) (*interviewv1.CompleteRetryItemInternalResponse, error) {
	if req.GetUserId() == "" || req.GetRetryItemId() == "" {
		return nil, invalidArgument("user_id and retry_item_id are required")
	}
	item, err := i.service.CompleteRetryItemInternal(ctx, req.GetUserId(), req.GetRetryItemId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &interviewv1.CompleteRetryItemInternalResponse{Item: toProtoRetryItem(item)}, nil
}
