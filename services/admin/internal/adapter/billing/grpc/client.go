package billinggrpc

import (
	"context"
	"fmt"

	billingadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/billing"
	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/protobuf/types/known/timestamppb"
)

const internalTokenHeader = "x-internal-token"

// Client calls billing-service public and admin gRPC APIs.
type Client struct {
	read    billingv1.BillingServiceClient
	admin   billingv1.BillingAdminServiceClient
	internal billingv1.BillingInternalServiceClient
	conn    *grpc.ClientConn
	token   string
}

// NewClient dials billing-service gRPC endpoint.
func NewClient(ctx context.Context, addr, internalToken string) (*Client, error) {
	conn, err := grpc.NewClient(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("dial billing grpc: %w", err)
	}
	if err := ctx.Err(); err != nil {
		_ = conn.Close()
		return nil, err
	}
	return &Client{
		read:     billingv1.NewBillingServiceClient(conn),
		admin:    billingv1.NewBillingAdminServiceClient(conn),
		internal: billingv1.NewBillingInternalServiceClient(conn),
		conn:     conn,
		token:    internalToken,
	}, nil
}

// Close releases the gRPC connection.
func (c *Client) Close() error {
	if c.conn == nil {
		return nil
	}
	return c.conn.Close()
}

func (c *Client) internalCtx(ctx context.Context) context.Context {
	return metadata.AppendToOutgoingContext(ctx, internalTokenHeader, c.token)
}

func (c *Client) Ping(ctx context.Context) error {
	_, err := c.read.ListPlans(ctx, &billingv1.ListPlansRequest{})
	return err
}

func (c *Client) ListPlans(ctx context.Context) ([]billingadapter.PlanCatalog, error) {
	resp, err := c.read.ListPlans(ctx, &billingv1.ListPlansRequest{})
	if err != nil {
		return nil, billingadapter.MapGRPCError(err)
	}
	out := make([]billingadapter.PlanCatalog, 0, len(resp.GetPlans()))
	for _, item := range resp.GetPlans() {
		out = append(out, fromProtoPlan(item))
	}
	return out, nil
}

func (c *Client) GetUserEntitlements(ctx context.Context, userID string) (*billingadapter.UserEntitlements, error) {
	resp, err := c.internal.GetEntitlements(c.internalCtx(ctx), &billingv1.GetEntitlementsRequest{UserId: userID})
	if err != nil {
		return nil, billingadapter.MapGRPCError(err)
	}
	return fromProtoEntitlements(resp.GetEntitlements()), nil
}

func (c *Client) GrantSubscription(ctx context.Context, input billingadapter.GrantSubscriptionInput) (*billingadapter.GrantSubscriptionResult, error) {
	req := &billingv1.GrantSubscriptionRequest{
		UserId:   input.UserID,
		PlanSlug: input.PlanSlug,
	}
	if input.CurrentPeriodEnd != nil {
		req.CurrentPeriodEnd = timestamppb.New(*input.CurrentPeriodEnd)
	}
	resp, err := c.admin.GrantSubscription(c.internalCtx(ctx), req)
	if err != nil {
		return nil, billingadapter.MapGRPCError(err)
	}
	return &billingadapter.GrantSubscriptionResult{
		SubscriptionID: resp.GetSubscriptionId(),
		PlanSlug:       resp.GetPlanSlug(),
		Status:         resp.GetStatus(),
	}, nil
}

func (c *Client) RevokeSubscription(ctx context.Context, userID string) (bool, error) {
	resp, err := c.admin.RevokeSubscription(c.internalCtx(ctx), &billingv1.RevokeSubscriptionRequest{UserId: userID})
	if err != nil {
		return false, billingadapter.MapGRPCError(err)
	}
	return resp.GetRevoked(), nil
}

func fromProtoPlan(p *billingv1.PlanCatalog) billingadapter.PlanCatalog {
	if p == nil {
		return billingadapter.PlanCatalog{}
	}
	out := billingadapter.PlanCatalog{
		Slug:       p.GetSlug(),
		Name:       p.GetName(),
		Tagline:    p.GetTagline(),
		Highlight:  p.GetHighlight(),
		Highlights: append([]string(nil), p.GetHighlights()...),
		Features:   map[string]bool{},
		Limits:     map[string]billingadapter.PlanEntitlementSpec{},
	}
	for k, v := range p.GetFeatures() {
		out.Features[k] = v
	}
	for k, lim := range p.GetLimits() {
		spec := billingadapter.PlanEntitlementSpec{
			Type:      lim.GetType(),
			Unlimited: lim.GetUnlimited(),
			Period:    lim.GetPeriod(),
			Value:     lim.GetValue(),
		}
		if lim.Limit != nil {
			v := int(lim.GetLimit())
			spec.Limit = &v
		}
		out.Limits[k] = spec
	}
	return out
}

func fromProtoEntitlements(v *billingv1.GetMeResponse) *billingadapter.UserEntitlements {
	if v == nil {
		return &billingadapter.UserEntitlements{}
	}
	out := &billingadapter.UserEntitlements{
		UserID:   v.GetUserId(),
		PlanSlug: v.GetPlanSlug(),
		PlanName: v.GetPlanName(),
		Features: map[string]bool{},
		Limits:   map[string]billingadapter.UsageLimit{},
	}
	for k, val := range v.GetFeatures() {
		out.Features[k] = val
	}
	for k, lim := range v.GetLimits() {
		item := billingadapter.UsageLimit{
			Used:        int(lim.GetUsed()),
			Unlimited:   lim.GetUnlimited(),
			PeriodStart: lim.GetPeriodStart().AsTime(),
			PeriodEnd:   lim.GetPeriodEnd().AsTime(),
		}
		if lim.Limit != nil {
			v := int(lim.GetLimit())
			item.Limit = &v
		}
		if lim.Remaining != nil {
			v := int(lim.GetRemaining())
			item.Remaining = &v
		}
		out.Limits[k] = item
	}
	return out
}

var _ billingadapter.Client = (*Client)(nil)

func (c *Client) GetPlatformStats(ctx context.Context) (int64, error) {
	resp, err := c.internal.GetPlatformStats(c.internalCtx(ctx), &billingv1.GetPlatformStatsRequest{})
	if err != nil {
		return 0, billingadapter.MapGRPCError(err)
	}
	return resp.GetActiveSubscriptions(), nil
}

func (c *Client) GetOpsStats(ctx context.Context) (*billingadapter.OpsStats, error) {
	resp, err := c.internal.GetOpsStats(c.internalCtx(ctx), &billingv1.GetOpsStatsRequest{})
	if err != nil {
		return nil, billingadapter.MapGRPCError(err)
	}
	return &billingadapter.OpsStats{
		ServiceName:       resp.GetServiceName(),
		DatabaseName:      resp.GetDatabaseName(),
		DatabaseSizeBytes: resp.GetDatabaseSizeBytes(),
		MemoryAllocBytes:  resp.GetMemoryAllocBytes(),
		MemorySysBytes:    resp.GetMemorySysBytes(),
		Goroutines:        int(resp.GetGoroutines()),
		HTTPRPS:           resp.GetHttpRps(),
	}, nil
}
