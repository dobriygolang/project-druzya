package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
)

// UpdatePlanEntitlement patches one plan entitlement limit/feature row.
func (i *Implementation) UpdatePlanEntitlement(ctx context.Context, req *billingv1.UpdatePlanEntitlementRequest) (*billingv1.UpdatePlanEntitlementResponse, error) {
	if req.GetPlanSlug() == "" || req.GetKey() == "" || req.GetSpec() == nil {
		return nil, invalidArgument("plan_slug, key and spec are required")
	}
	spec, err := entitlementValueFromProto(req.GetSpec())
	if err != nil {
		return nil, invalidArgument(err.Error())
	}
	updated, err := i.svc.UpdatePlanEntitlement(ctx, req.GetPlanSlug(), req.GetKey(), spec)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &billingv1.UpdatePlanEntitlementResponse{
		PlanSlug: req.GetPlanSlug(),
		Key:      req.GetKey(),
		Spec:     entitlementSpecToProto(updated),
	}, nil
}

func entitlementValueFromProto(spec *billingv1.PlanEntitlementSpec) (entitlement.Value, error) {
	if spec == nil {
		return entitlement.Value{}, errInvalidEntitlementSpec("spec is nil")
	}
	v := entitlement.Value{
		Type:   spec.GetType(),
		Period: spec.GetPeriod(),
		Value:  spec.GetValue(),
	}
	if spec.Unlimited {
		v.Limit = nil
	} else if spec.Limit != nil {
		limit := int(spec.GetLimit())
		v.Limit = &limit
	}
	switch v.Type {
	case entitlement.TypeBool, entitlement.TypeCounter, entitlement.TypeGauge:
		return v, nil
	default:
		return entitlement.Value{}, errInvalidEntitlementSpec("unsupported type")
	}
}

func entitlementSpecToProto(v entitlement.Value) *billingv1.PlanEntitlementSpec {
	out := &billingv1.PlanEntitlementSpec{
		Type:      v.Type,
		Period:    v.Period,
		Value:     v.Value,
		Unlimited: v.Limit == nil && (v.Type == entitlement.TypeCounter || v.Type == entitlement.TypeGauge),
	}
	if v.Limit != nil {
		limit := int32(*v.Limit)
		out.Limit = &limit
	}
	return out
}

type invalidEntitlementSpecError string

func (e invalidEntitlementSpecError) Error() string { return string(e) }

func errInvalidEntitlementSpec(msg string) error {
	return invalidEntitlementSpecError(msg)
}
