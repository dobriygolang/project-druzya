package service

import (
	"context"
	"fmt"
	"sort"

	aiadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/ai"
	billingadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing"
	contentadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/content"
	identityadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/identity"
)

const dashboardSampleLimit = 500

// ServiceHealth is downstream reachability for the dashboard.
type ServiceHealth struct {
	Name  string
	OK    bool
	Error string
}

// CatalogCounts is sampled catalog cardinality.
type CatalogCounts struct {
	Companies int
	Tasks     int
	Templates int
	Plans     int
	Articles  int
}

// EvaluationJobCounts aggregates recent evaluation job samples.
type EvaluationJobCounts struct {
	Pending   int
	Running   int
	Failed    int
	Completed int
}

// UserStats is platform user and subscription metrics.
type UserStats struct {
	TotalUsers          int64
	NewUsers24h         int64
	NewUsers7d          int64
	NewUsers30d         int64
	ActiveUsers7d       int64
	ActiveSubscriptions int64
}

// ServiceRuntime is per-service DB footprint and process metrics.
type ServiceRuntime struct {
	Name              string
	DatabaseName      string
	DatabaseSizeBytes int64
	MemoryAllocBytes  int64
	MemorySysBytes    int64
	Goroutines        int
	HTTPRPS           float64
}

// Dashboard is the operator overview snapshot.
type Dashboard struct {
	Services              []ServiceHealth
	Catalog               CatalogCounts
	EvaluationJobs        EvaluationJobCounts
	RecentFailedJobs      []aiadapter.EvaluationJob
	LLMConfig             *aiadapter.LLMRuntimeConfig
	Users                 UserStats
	Runtimes              []ServiceRuntime
	TotalHTTPRPS          float64
	TotalDatabaseSizeBytes int64
}

type pinger interface {
	Ping(ctx context.Context) error
}

func (s *adminService) GetDashboard(ctx context.Context) (*Dashboard, error) {
	out := &Dashboard{
		Services: []ServiceHealth{
			s.checkService(ctx, "identity", s.identity),
			s.checkService(ctx, "content", s.content),
			s.checkService(ctx, "billing", s.billing),
			s.checkService(ctx, "ai", s.ai),
		},
	}

	if s.identity != nil {
		stats, err := s.identity.GetUserStats(ctx)
		if err != nil {
			return nil, fmt.Errorf("get user stats: %w", err)
		}
		out.Users = UserStats{
			TotalUsers:    stats.TotalUsers,
			NewUsers24h:   stats.NewUsers24h,
			NewUsers7d:    stats.NewUsers7d,
			NewUsers30d:   stats.NewUsers30d,
			ActiveUsers7d: stats.ActiveUsers7d,
		}
	}
	if s.billing != nil {
		activeSubs, err := s.billing.GetPlatformStats(ctx)
		if err != nil {
			return nil, fmt.Errorf("get platform stats: %w", err)
		}
		out.Users.ActiveSubscriptions = activeSubs
	}

	runtimes, totalRPS, totalDB, err := s.collectRuntimes(ctx)
	if err != nil {
		return nil, err
	}
	out.Runtimes = runtimes
	out.TotalHTTPRPS = totalRPS
	out.TotalDatabaseSizeBytes = totalDB

	companies, err := s.content.ListCompanies(ctx, contentadapter.ListCompaniesFilter{Limit: dashboardSampleLimit})
	if err != nil {
		return nil, fmt.Errorf("list companies: %w", err)
	}
	tasks, err := s.content.ListTasks(ctx, contentadapter.ListTasksFilter{Limit: dashboardSampleLimit, Status: strPtr("")})
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	templates, err := s.content.ListInterviewTemplates(ctx, contentadapter.ListInterviewTemplatesFilter{Limit: dashboardSampleLimit})
	if err != nil {
		return nil, fmt.Errorf("list templates: %w", err)
	}
	articles, err := s.content.ListArticles(ctx, contentadapter.ListArticlesFilter{IncludeAll: true, Limit: dashboardSampleLimit})
	if err != nil {
		return nil, fmt.Errorf("list articles: %w", err)
	}
	plans, err := s.billing.ListPlans(ctx)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	out.Catalog = CatalogCounts{
		Companies: len(companies),
		Tasks:     len(tasks),
		Templates: len(templates),
		Plans:     len(plans),
		Articles:  len(articles),
	}

	jobs, err := s.ai.ListEvaluationJobs(ctx, nil, dashboardSampleLimit)
	if err != nil {
		return nil, fmt.Errorf("list evaluation jobs: %w", err)
	}
	out.EvaluationJobs = countEvaluationJobs(jobs)
	out.RecentFailedJobs = recentFailedJobs(jobs, 10)

	cfg, err := s.ai.GetLLMConfig(ctx)
	if err != nil {
		return nil, fmt.Errorf("get llm config: %w", err)
	}
	out.LLMConfig = cfg
	return out, nil
}

func (s *adminService) collectRuntimes(ctx context.Context) ([]ServiceRuntime, float64, int64, error) {
	var runtimes []ServiceRuntime
	var totalRPS float64
	var totalDB int64

	appendRuntime := func(stats *contentadapter.OpsStats) {
		if stats == nil {
			return
		}
		runtimes = append(runtimes, ServiceRuntime{
			Name:              stats.ServiceName,
			DatabaseName:      stats.DatabaseName,
			DatabaseSizeBytes: stats.DatabaseSizeBytes,
			MemoryAllocBytes:  stats.MemoryAllocBytes,
			MemorySysBytes:    stats.MemorySysBytes,
			Goroutines:        stats.Goroutines,
			HTTPRPS:           stats.HTTPRPS,
		})
		totalRPS += stats.HTTPRPS
		totalDB += stats.DatabaseSizeBytes
	}

	if s.identity != nil {
		stats, err := s.identity.GetOpsStats(ctx)
		if err != nil {
			return nil, 0, 0, fmt.Errorf("identity ops stats: %w", err)
		}
		appendRuntime(toContentOpsStats(stats))
	}
	if s.content != nil {
		stats, err := s.content.GetOpsStats(ctx)
		if err != nil {
			return nil, 0, 0, fmt.Errorf("content ops stats: %w", err)
		}
		appendRuntime(stats)
	}
	if s.billing != nil {
		stats, err := s.billing.GetOpsStats(ctx)
		if err != nil {
			return nil, 0, 0, fmt.Errorf("billing ops stats: %w", err)
		}
		appendRuntime(toContentOpsStatsFromBilling(stats))
	}
	if s.ai != nil {
		stats, err := s.ai.GetOpsStats(ctx)
		if err != nil {
			return nil, 0, 0, fmt.Errorf("ai ops stats: %w", err)
		}
		appendRuntime(toContentOpsStatsFromAI(stats))
	}

	sort.Slice(runtimes, func(i, j int) bool {
		return runtimes[i].Name < runtimes[j].Name
	})
	return runtimes, totalRPS, totalDB, nil
}

func toContentOpsStats(stats *identityadapter.OpsStats) *contentadapter.OpsStats {
	if stats == nil {
		return nil
	}
	return &contentadapter.OpsStats{
		ServiceName:       stats.ServiceName,
		DatabaseName:      stats.DatabaseName,
		DatabaseSizeBytes: stats.DatabaseSizeBytes,
		MemoryAllocBytes:  stats.MemoryAllocBytes,
		MemorySysBytes:    stats.MemorySysBytes,
		Goroutines:        stats.Goroutines,
		HTTPRPS:           stats.HTTPRPS,
	}
}

func toContentOpsStatsFromBilling(stats *billingadapter.OpsStats) *contentadapter.OpsStats {
	if stats == nil {
		return nil
	}
	return &contentadapter.OpsStats{
		ServiceName:       stats.ServiceName,
		DatabaseName:      stats.DatabaseName,
		DatabaseSizeBytes: stats.DatabaseSizeBytes,
		MemoryAllocBytes:  stats.MemoryAllocBytes,
		MemorySysBytes:    stats.MemorySysBytes,
		Goroutines:        stats.Goroutines,
		HTTPRPS:           stats.HTTPRPS,
	}
}

func toContentOpsStatsFromAI(stats *aiadapter.OpsStats) *contentadapter.OpsStats {
	if stats == nil {
		return nil
	}
	return &contentadapter.OpsStats{
		ServiceName:       stats.ServiceName,
		DatabaseName:      stats.DatabaseName,
		DatabaseSizeBytes: stats.DatabaseSizeBytes,
		MemoryAllocBytes:  stats.MemoryAllocBytes,
		MemorySysBytes:    stats.MemorySysBytes,
		Goroutines:        stats.Goroutines,
		HTTPRPS:           stats.HTTPRPS,
	}
}

func (s *adminService) checkService(ctx context.Context, name string, client pinger) ServiceHealth {
	if client == nil {
		return ServiceHealth{Name: name, OK: false, Error: "client not configured"}
	}
	if err := client.Ping(ctx); err != nil {
		return ServiceHealth{Name: name, OK: false, Error: err.Error()}
	}
	return ServiceHealth{Name: name, OK: true}
}

func countEvaluationJobs(jobs []aiadapter.EvaluationJob) EvaluationJobCounts {
	var out EvaluationJobCounts
	for _, job := range jobs {
		switch job.Status {
		case aiadapter.JobStatusPending:
			out.Pending++
		case aiadapter.JobStatusRunning:
			out.Running++
		case aiadapter.JobStatusFailed:
			out.Failed++
		case aiadapter.JobStatusCompleted:
			out.Completed++
		}
	}
	return out
}

func recentFailedJobs(jobs []aiadapter.EvaluationJob, limit int) []aiadapter.EvaluationJob {
	failed := make([]aiadapter.EvaluationJob, 0, limit)
	for _, job := range jobs {
		if job.Status != aiadapter.JobStatusFailed {
			continue
		}
		failed = append(failed, job)
	}
	sort.Slice(failed, func(i, j int) bool {
		return failed[i].UpdatedAt.After(failed[j].UpdatedAt)
	})
	if len(failed) > limit {
		failed = failed[:limit]
	}
	return failed
}

func strPtr(v string) *string {
	return &v
}
