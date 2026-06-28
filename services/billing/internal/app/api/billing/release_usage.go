package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

// ReleaseUsage compensates previously consumed usage quota.
func (i *Implementation) ReleaseUsage(ctx context.Context, req *billingv1.ReleaseUsageRequest) (*billingv1.ReleaseUsageResponse, error) {
	if req.GetUserId() == "" || req.GetKey() == "" || req.GetIdempotencyKey() == "" {
		return nil, invalidArgument("user_id, key and idempotency_key are required")
	}
	amount := int(req.GetAmount())
	if amount <= 0 {
		amount = 1
	}
	result, err := i.svc.ReleaseUsage(ctx, req.GetUserId(), req.GetKey(), req.GetIdempotencyKey(), amount)
	if err != nil {
		return nil, mapServiceError(err)
	}
	resp := &billingv1.ReleaseUsageResponse{
		Released: result.Released,
		Used:     int32(result.Used),
		Reason:   result.Reason,
	}
	if result.Limit != nil {
		v := int32(*result.Limit)
		resp.Limit = &v
	}
	if result.Remaining != nil {
		v := int32(*result.Remaining)
		resp.Remaining = &v
	}
	return resp, nil
}
