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

func TestIncludeHiddenTestsRequiresEntitlement(t *testing.T) {
	t.Parallel()
	svc := New(Deps{
		Billing: &stubBilling{entitlementErr: billingadapter.ErrFeatureDisabled},
	}).(*sandboxService)

	if svc.includeHiddenTests(context.Background(), "user-1", model.RunTypeSubmit) {
		t.Fatal("expected hidden tests disabled on free plan")
	}
	if svc.includeHiddenTests(context.Background(), "user-1", model.RunTypeSample) {
		t.Fatal("sample runs must not include hidden tests")
	}
}

func TestIncludeHiddenTestsWhenEntitled(t *testing.T) {
	t.Parallel()
	svc := New(Deps{Billing: &stubBilling{}}).(*sandboxService)

	if !svc.includeHiddenTests(context.Background(), "user-1", model.RunTypeSubmit) {
		t.Fatal("expected hidden tests when entitlement passes")
	}
}

func TestGateCodeRunSubmitAllowedWithoutHiddenEntitlement(t *testing.T) {
	t.Parallel()
	svc := New(Deps{
		Billing: &stubBilling{entitlementErr: billingadapter.ErrFeatureDisabled},
	}).(*sandboxService)

	if err := svc.gateCodeRun(context.Background(), "user-1", model.RunTypeSubmit); err != nil {
		t.Fatalf("submit run should not be blocked without hidden tests, got %v", err)
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
