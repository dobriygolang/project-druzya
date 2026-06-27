package service

import (
	"context"
	"errors"

	billingadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/billing"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func (s *interviewService) gateSessionStart(ctx context.Context, userID string, mode interviewmodel.SessionMode) error {
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
	if err := s.billing.CheckAndConsumeUsage(ctx, userID, billingadapter.EntitlementMockInterviewsPerMonth, 1); err != nil {
		if errors.Is(err, billingadapter.ErrQuotaExceeded) {
			return ErrQuotaExceeded
		}
		return err
	}
	return nil
}
