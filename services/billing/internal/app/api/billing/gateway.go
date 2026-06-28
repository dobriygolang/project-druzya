package billingapi

import (
	"context"
	"net/http"

	billingv1 "github.com/sedorofeevd/project-druzya/services/billing/pkg/api/billing/v1"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/humanerror"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func newGatewayMux(ctx context.Context, endpoint string) (http.Handler, error) {
	mux := runtime.NewServeMux(
		runtime.WithIncomingHeaderMatcher(func(key string) (string, bool) {
			if key == "Authorization" {
				return "authorization", true
			}
			return runtime.DefaultHeaderMatcher(key)
		}),
		runtime.WithErrorHandler(func(
		ctx context.Context,
		_ *runtime.ServeMux,
		_ runtime.Marshaler,
		w http.ResponseWriter,
		_ *http.Request,
		err error,
	) {
		humanerror.WriteHTTP(w, err)
	}))
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	if err := billingv1.RegisterBillingServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
		return nil, err
	}
	if err := billingv1.RegisterBillingAdminServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
		return nil, err
	}
	return mux, nil
}

// RegisterGateway mounts grpc-gateway handlers.
func RegisterGateway(ctx context.Context, mux *http.ServeMux, endpoint string) error {
	gw, err := newGatewayMux(ctx, endpoint)
	if err != nil {
		return err
	}
	mux.Handle("/v1/", gw)
	return nil
}

// HealthzHTTP returns service health.
func HealthzHTTP() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}
