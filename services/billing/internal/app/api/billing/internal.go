package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

// GetEntitlements returns entitlements for a user (internal).
func (i *Implementation) GetEntitlements(ctx context.Context, req *billingv1.GetEntitlementsRequest) (*billingv1.GetEntitlementsResponse, error) {
	if req.GetUserId() == "" {
		return nil, invalidArgument("user_id is required")
	}
	view, err := i.svc.GetEntitlements(ctx, req.GetUserId())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &billingv1.GetEntitlementsResponse{Entitlements: toProtoEntitlements(view)}, nil
}

// CheckEntitlement verifies a boolean feature gate.
func (i *Implementation) CheckEntitlement(ctx context.Context, req *billingv1.CheckEntitlementRequest) (*billingv1.CheckEntitlementResponse, error) {
	if req.GetUserId() == "" || req.GetKey() == "" {
		return nil, invalidArgument("user_id and key are required")
	}
	result, err := i.svc.CheckEntitlement(ctx, req.GetUserId(), req.GetKey())
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &billingv1.CheckEntitlementResponse{
		Allowed: result.Allowed,
		Value:   result.Value,
		Reason:  result.Reason,
	}, nil
}

// CheckAndConsumeUsage atomically checks and increments a usage counter.
func (i *Implementation) CheckAndConsumeUsage(ctx context.Context, req *billingv1.CheckAndConsumeUsageRequest) (*billingv1.CheckAndConsumeUsageResponse, error) {
	if req.GetUserId() == "" || req.GetKey() == "" {
		return nil, invalidArgument("user_id and key are required")
	}
	amount := int(req.GetAmount())
	if amount <= 0 {
		amount = 1
	}
	result, err := i.svc.CheckAndConsumeUsage(ctx, req.GetUserId(), req.GetKey(), amount)
	if err != nil {
		return nil, mapServiceError(err)
	}
	resp := &billingv1.CheckAndConsumeUsageResponse{
		Allowed: result.Allowed,
		Used:    int32(result.Used),
		Reason:  result.Reason,
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
