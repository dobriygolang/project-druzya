package service

import (
	"context"
	"errors"

	billingadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

func (s *sandboxService) gateCodeRun(ctx context.Context, userID, runType string) error {
	if s.billing == nil {
		return nil
	}
	if runType == model.RunTypeSubmit {
		if err := s.billing.CheckEntitlement(ctx, userID, billingadapter.EntitlementHiddenTestsEnabled); err != nil {
			if errors.Is(err, billingadapter.ErrFeatureDisabled) {
				return ErrFeatureDisabled
			}
			return err
		}
	}
	if err := s.billing.CheckAndConsumeUsage(ctx, userID, billingadapter.EntitlementCodeRunsPerDay, 1); err != nil {
		if errors.Is(err, billingadapter.ErrQuotaExceeded) {
			return ErrQuotaExceeded
		}
		return err
	}
	return nil
}
