package billingapi

import (
	billingrepo "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
	billingservice "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/service"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/config"
	"google.golang.org/grpc"
)

// CheckoutFromConfig maps billing config to transport checkout URLs.
func CheckoutFromConfig(cfg config.TributeCheckoutConfig) CheckoutConfig {
	out := CheckoutConfig{ByPlan: make(map[string]PlanCheckoutURLs, len(cfg.ByPlan))}
	for slug, links := range cfg.ByPlan {
		out.ByPlan[slug] = PlanCheckoutURLs{
			WebURL:      links.WebURL,
			TelegramURL: links.TelegramURL,
		}
	}
	return out
}

// ProTrialFromConfig maps billing config to transport trial settings.
func ProTrialFromConfig(cfg *config.Config) ProTrialConfig {
	if cfg == nil {
		return ProTrialConfig{Enabled: true, Days: 14}
	}
	return ProTrialConfig{Enabled: cfg.ProTrialEnabled, Days: cfg.ProTrialDays}
}

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(
	s *grpc.Server,
	svc billingservice.Service,
	repo *billingrepo.Repository,
	pg *billingrepo.Pool,
	checkout CheckoutConfig,
	proTrial ProTrialConfig,
) *Implementation {
	impl := NewImplementation(svc, repo, pg, checkout, proTrial)
	Register(s, impl)
	return impl
}
