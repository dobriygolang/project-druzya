package service

import (
	"context"
	"testing"

	billingadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing"
)

type stubBilling struct {
	usageErr error
}

func (s *stubBilling) CheckEntitlement(context.Context, string, string) error {
	return nil
}

func (s *stubBilling) CheckAndConsumeUsage(context.Context, string, string, int) error {
	return s.usageErr
}

func TestGateCodeRunConsumesUsage(t *testing.T) {
	t.Parallel()
	svc := New(Deps{
		Billing: &stubBilling{usageErr: billingadapter.ErrQuotaExceeded},
	}).(*sandboxService)

	err := svc.gateCodeRun(context.Background(), "user-1")
	if err != ErrQuotaExceeded {
		t.Fatalf("expected quota exceeded, got %v", err)
	}
}

func TestGateCodeRunWithoutBilling(t *testing.T) {
	t.Parallel()
	svc := New(Deps{}).(*sandboxService)
	if err := svc.gateCodeRun(context.Background(), "user-1"); err != nil {
		t.Fatalf("expected nil without billing, got %v", err)
	}
}
