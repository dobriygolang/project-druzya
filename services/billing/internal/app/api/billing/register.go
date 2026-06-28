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

// NewRegisteredImplementation constructs handlers and registers them on the gRPC server.
func NewRegisteredImplementation(
	s *grpc.Server,
	svc billingservice.Service,
	repo *billingrepo.Repository,
	pg *billingrepo.Pool,
	checkout CheckoutConfig,
) *Implementation {
	impl := NewImplementation(svc, repo, pg, checkout)
	Register(s, impl)
	return impl
}
