package interviewapi

import (
	"context"

	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// ListRetryItems returns retry queue items for the authenticated user.
func (i *Implementation) ListRetryItems(
	ctx context.Context,
	req *interviewv1.ListRetryItemsRequest,
) (*interviewv1.ListRetryItemsResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	var statusPtr *interviewv1.RetryItemStatus
	if req.Status != nil {
		statusPtr = req.Status
	}
	statusFilter, err := parseRetryItemStatusFilter(statusPtr)
	if err != nil {
		return nil, err
	}

	items, err := i.service.ListRetryItems(ctx, userID, statusFilter)
	if err != nil {
		return nil, mapServiceError(err)
	}

	protoItems := make([]*interviewv1.RetryItem, 0, len(items))
	for idx := range items {
		protoItems = append(protoItems, toProtoRetryItem(&items[idx]))
	}

	return &interviewv1.ListRetryItemsResponse{Items: protoItems}, nil
}
