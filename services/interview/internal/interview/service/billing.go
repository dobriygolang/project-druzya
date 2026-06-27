package service

import (
	"context"
	"errors"

	billingadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

// checkSessionEntitlement verifies feature gates without consuming any quota.
// Safe to call before doing work since it has no side effects.
func (s *interviewService) checkSessionEntitlement(ctx context.Context, userID string, mode interviewmodel.SessionMode) error {
	if s.billing == nil {
		return nil
	}
	if mode == interviewmodel.ModeCompanyInterview {
		if err := s.billing.CheckEntitlement(ctx, userID, billingadapter.EntitlementCompanyTemplatesEnabled); err != nil {
			if errors.Is(err, billingadapter.ErrFeatureDisabled) {
				return ErrFeatureDisabled
			}
			return err
		}
	}
	return nil
}

// consumeSessionQuota debits the monthly mock-interview quota. Must run only
// after the session has been persisted so a failed creation never burns quota.
func (s *interviewService) consumeSessionQuota(ctx context.Context, userID string) error {
	if s.billing == nil {
		return nil
	}
	if err := s.billing.CheckAndConsumeUsage(ctx, userID, billingadapter.EntitlementMockInterviewsPerMonth, 1); err != nil {
		if errors.Is(err, billingadapter.ErrQuotaExceeded) {
			return ErrQuotaExceeded
		}
		return err
	}
	return nil
}
