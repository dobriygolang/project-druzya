package interviewapi

import (
	"context"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// ListRetryItemsInternal returns retry queue items for a user (internal RPC).
func (i *Implementation) ListRetryItemsInternal(
	ctx context.Context,
	req *interviewv1.ListRetryItemsInternalRequest,
) (*interviewv1.ListRetryItemsInternalResponse, error) {
	if req.GetUserId() == "" {
		return nil, invalidArgument("user_id is required")
	}
	var statusFilter *interviewmodel.RetryItemStatus
	if req.Status != nil {
		st, err := retryItemStatusFromProto(req.GetStatus())
		if err != nil {
			return nil, invalidArgument(err.Error())
		}
		statusFilter = st
	}
	items, err := i.service.ListRetryItemsInternal(ctx, req.GetUserId(), statusFilter)
	if err != nil {
		return nil, mapServiceError(err)
	}
	protoItems := make([]*interviewv1.RetryItem, 0, len(items))
	for idx := range items {
		protoItems = append(protoItems, toProtoRetryItem(&items[idx]))
	}
	return &interviewv1.ListRetryItemsInternalResponse{Items: protoItems}, nil
}
