package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
)

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
