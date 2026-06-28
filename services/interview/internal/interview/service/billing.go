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

func sessionConsumesMockQuota(mode interviewmodel.SessionMode) bool {
	return mode != interviewmodel.ModeRetryMistakes
}

func sessionQuotaReleaseKey(sessionID string) string {
	return "session-pause:" + sessionID
}

// releaseSessionQuota returns mock quota debited at session start (idempotent per session).
func (s *interviewService) releaseSessionQuota(ctx context.Context, userID, sessionID string) error {
	if s.billing == nil {
		return nil
	}
	return s.billing.ReleaseUsage(
		ctx,
		userID,
		billingadapter.EntitlementMockInterviewsPerMonth,
		sessionQuotaReleaseKey(sessionID),
		1,
	)
}
