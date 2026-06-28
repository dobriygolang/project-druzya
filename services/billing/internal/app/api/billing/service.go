package billingapi

import (
	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/catalog"
	billingservice "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/service"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/model"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Implementation serves billing gRPC/HTTP APIs.
type Implementation struct {
	billingv1.UnimplementedBillingServiceServer
	billingv1.UnimplementedBillingInternalServiceServer
	billingv1.UnimplementedBillingAdminServiceServer
	svc billingservice.Service
}

// NewImplementation constructs transport handlers.
func NewImplementation(svc billingservice.Service) *Implementation {
	return &Implementation{svc: svc}
}

// Register mounts billing services on the gRPC server.
func Register(s *grpc.Server, impl *Implementation) {
	billingv1.RegisterBillingServiceServer(s, impl)
	billingv1.RegisterBillingInternalServiceServer(s, impl)
	billingv1.RegisterBillingAdminServiceServer(s, impl)
}

func toProtoEntitlements(view *model.EntitlementsView) *billingv1.GetMeResponse {
	if view == nil {
		return &billingv1.GetMeResponse{}
	}
	out := &billingv1.GetMeResponse{
		UserId:   view.UserID,
		PlanSlug: view.PlanSlug,
		PlanName: view.PlanName,
		Features: map[string]bool{},
		Limits:   map[string]*billingv1.UsageLimit{},
	}
	for k, v := range view.Features {
		out.Features[k] = v
	}
	for k, lim := range view.Limits {
		item := &billingv1.UsageLimit{
			Used:      int32(lim.Used),
			Unlimited: lim.Unlimited,
			PeriodStart: timestamppb.New(lim.PeriodStart),
			PeriodEnd:   timestamppb.New(lim.PeriodEnd),
		}
		if lim.Limit != nil {
			v := int32(*lim.Limit)
			item.Limit = &v
		}
		if lim.Remaining != nil {
			v := int32(*lim.Remaining)
			item.Remaining = &v
		}
		out.Limits[k] = item
	}
	return out
}

func toProtoPlanCatalog(item catalog.PlanCatalogItem) *billingv1.PlanCatalog {
	out := &billingv1.PlanCatalog{
		Slug:       item.Slug,
		Name:       item.Name,
		Tagline:    item.Tagline,
		Highlight:  item.Highlight,
		Highlights: append([]string(nil), item.Highlights...),
		Features:   map[string]bool{},
		Limits:     map[string]*billingv1.PlanEntitlementSpec{},
	}
	for k, v := range item.Features {
		out.Features[k] = v
	}
	for k, lim := range item.Limits {
		spec := &billingv1.PlanEntitlementSpec{
			Type:      lim.Type,
			Unlimited: lim.Unlimited,
			Period:    lim.Period,
			Value:     lim.Value,
		}
		if lim.Limit != nil {
			v := int32(*lim.Limit)
			spec.Limit = &v
		}
		out.Limits[k] = spec
	}
	return out
}
