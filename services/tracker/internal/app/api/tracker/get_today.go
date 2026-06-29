package trackerapi

import (
	"context"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
)

func (i *Implementation) GetToday(ctx context.Context, req *trackerv1.GetTodayRequest) (*trackerv1.GetTodayResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}
	var localDate, timezone *string
	if req.LocalDate != nil {
		localDate = req.LocalDate
	}
	if req.Timezone != nil {
		timezone = req.Timezone
	}
	view, err := i.svc.GetToday(ctx, userID, localDate, timezone)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return todayViewToProto(view), nil
}
