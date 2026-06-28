package billingapi

import (
	"context"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// StartProTrial activates a one-time internal Pro trial for the authenticated user.
func (i *Implementation) StartProTrial(ctx context.Context, _ *billingv1.StartProTrialRequest) (*billingv1.StartProTrialResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	sub, err := i.svc.StartProTrial(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &billingv1.StartProTrialResponse{
		PlanSlug:  sub.PlanSlug,
		TrialDays: int32(i.proTrial.Days),
	}
	if i.proTrial.Days <= 0 {
		out.TrialDays = 14
	}
	if sub.CurrentPeriodEnd != nil {
		out.TrialEnd = timestamppb.New(*sub.CurrentPeriodEnd)
	}
	return out, nil
}
