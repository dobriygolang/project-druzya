package service

import (
	"context"
	"errors"

	billingadapter "github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/billing"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

func (s *sandboxService) includeHiddenTests(ctx context.Context, userID, runType string) bool {
	if runType != model.RunTypeSubmit {
		return false
	}
	if s.billing == nil {
		return true
	}
	err := s.billing.CheckEntitlement(ctx, userID, billingadapter.EntitlementHiddenTestsEnabled)
	return err == nil
}

func (s *sandboxService) gateCodeRun(ctx context.Context, userID, runType string) error {
	if s.billing == nil {
		return nil
	}
	if err := s.billing.CheckAndConsumeUsage(ctx, userID, billingadapter.EntitlementCodeRunsPerDay, 1); err != nil {
		if errors.Is(err, billingadapter.ErrQuotaExceeded) {
			return ErrQuotaExceeded
		}
		return err
	}
	return nil
}
