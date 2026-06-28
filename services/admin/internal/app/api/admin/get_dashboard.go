package adminapi

import (
	"context"

	adminservice "github.com/sedorofeevd/project-druzya/services/admin/internal/admin/service"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// GetDashboard returns operator overview metrics and health.
func (i *Implementation) GetDashboard(ctx context.Context, _ *adminv1.GetDashboardRequest) (*adminv1.GetDashboardResponse, error) {
	dashboard, err := i.service.GetDashboard(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return toProtoDashboard(dashboard), nil
}

func toProtoDashboard(d *adminservice.Dashboard) *adminv1.GetDashboardResponse {
	if d == nil {
		return &adminv1.GetDashboardResponse{}
	}
	out := &adminv1.GetDashboardResponse{
		Services: make([]*adminv1.ServiceHealth, 0, len(d.Services)),
		Catalog: &adminv1.CatalogCounts{
			Companies: int32(d.Catalog.Companies),
			Tasks:     int32(d.Catalog.Tasks),
			Templates: int32(d.Catalog.Templates),
			Plans:     int32(d.Catalog.Plans),
			Articles:  int32(d.Catalog.Articles),
		},
		EvaluationJobs: &adminv1.EvaluationJobCounts{
			Pending:   int32(d.EvaluationJobs.Pending),
			Running:   int32(d.EvaluationJobs.Running),
			Failed:    int32(d.EvaluationJobs.Failed),
			Completed: int32(d.EvaluationJobs.Completed),
		},
		Users: &adminv1.UserStats{
			TotalUsers:          d.Users.TotalUsers,
			NewUsers_24H:        d.Users.NewUsers24h,
			NewUsers_7D:         d.Users.NewUsers7d,
			NewUsers_30D:        d.Users.NewUsers30d,
			ActiveUsers_7D:      d.Users.ActiveUsers7d,
			ActiveSubscriptions: d.Users.ActiveSubscriptions,
		},
		Runtimes:               make([]*adminv1.ServiceRuntime, 0, len(d.Runtimes)),
		TotalHttpRps:           d.TotalHTTPRPS,
		TotalDatabaseSizeBytes: d.TotalDatabaseSizeBytes,
	}
	for _, svc := range d.Services {
		item := &adminv1.ServiceHealth{Name: svc.Name, Ok: svc.OK}
		if svc.Error != "" {
			item.Error = &svc.Error
		}
		out.Services = append(out.Services, item)
	}
	for _, job := range d.RecentFailedJobs {
		out.RecentFailedJobs = append(out.RecentFailedJobs, &adminv1.EvaluationJobAlert{
			Id:        job.ID,
			AttemptId: job.AttemptID,
			UserId:    job.UserID,
			Status:    string(job.Status),
			Error:     job.Error,
			UpdatedAt: timestamppb.New(job.UpdatedAt),
		})
	}
	if d.LLMConfig != nil {
		out.LlmConfig = toProtoLLMConfig(d.LLMConfig)
	}
	for _, rt := range d.Runtimes {
		out.Runtimes = append(out.Runtimes, &adminv1.ServiceRuntime{
			Name:              rt.Name,
			DatabaseName:      rt.DatabaseName,
			DatabaseSizeBytes: rt.DatabaseSizeBytes,
			MemoryAllocBytes:  rt.MemoryAllocBytes,
			MemorySysBytes:    rt.MemorySysBytes,
			Goroutines:        int32(rt.Goroutines),
			HttpRps:           rt.HTTPRPS,
		})
	}
	return out
}
