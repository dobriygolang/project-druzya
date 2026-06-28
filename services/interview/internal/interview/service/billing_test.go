package service

import (
	"context"
	"testing"

	billingadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
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

func (s *stubBilling) ReleaseUsage(context.Context, string, string, string, int) error {
	return s.usageErr
}

func TestCheckSessionEntitlementCompanyRequiresEntitlement(t *testing.T) {
	t.Parallel()
	svc := New(Deps{
		Repo:    nil,
		Billing: &stubBilling{entitlementErr: billingadapter.ErrFeatureDisabled},
	}).(*interviewService)

	err := svc.checkSessionEntitlement(context.Background(), "user-1", interviewmodel.ModeCompanyInterview)
	if err != ErrFeatureDisabled {
		t.Fatalf("expected feature disabled, got %v", err)
	}
}

func TestConsumeSessionQuotaRejectsOverLimit(t *testing.T) {
	t.Parallel()
	svc := New(Deps{
		Repo:    nil,
		Billing: &stubBilling{usageErr: billingadapter.ErrQuotaExceeded},
	}).(*interviewService)

	err := svc.consumeSessionQuota(context.Background(), "user-1")
	if err != ErrQuotaExceeded {
		t.Fatalf("expected quota exceeded, got %v", err)
	}
}
