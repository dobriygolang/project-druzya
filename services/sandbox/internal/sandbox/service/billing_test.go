package service

import (
	"context"
	"testing"

	billingadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

type stubBilling struct {
	entitlementErr error
	usageErr       error
}

func (s *stubBilling) CheckEntitlement(context.Context, string, string) error {
	return s.entitlementErr
}

func (s *stubBilling) CheckAndConsumeUsage(context.Context, string, string, int) error {
	return s.usageErr
}

func TestGateCodeRunSubmitRequiresHiddenTests(t *testing.T) {
	t.Parallel()
	svc := New(Deps{
		Billing: &stubBilling{entitlementErr: billingadapter.ErrFeatureDisabled},
	}).(*sandboxService)

	err := svc.gateCodeRun(context.Background(), "user-1", model.RunTypeSubmit)
	if err != ErrFeatureDisabled {
		t.Fatalf("expected feature disabled, got %v", err)
	}
}

func TestGateCodeRunConsumesUsage(t *testing.T) {
	t.Parallel()
	svc := New(Deps{
		Billing: &stubBilling{usageErr: billingadapter.ErrQuotaExceeded},
	}).(*sandboxService)

	err := svc.gateCodeRun(context.Background(), "user-1", model.RunTypeSample)
	if err != ErrQuotaExceeded {
		t.Fatalf("expected quota exceeded, got %v", err)
	}
}
