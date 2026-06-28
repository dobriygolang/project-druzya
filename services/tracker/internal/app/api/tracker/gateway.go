package trackerapi

import (
	"context"
	"net/http"
	"strings"

	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tools/humanerror"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func newGatewayMux(ctx context.Context, endpoint string) (http.Handler, error) {
	mux := runtime.NewServeMux(
		runtime.WithIncomingHeaderMatcher(func(key string) (string, bool) {
			switch strings.ToLower(key) {
			case "authorization":
				return "authorization", true
			default:
				return runtime.DefaultHeaderMatcher(key)
			}
		}),
		runtime.WithErrorHandler(func(ctx context.Context, _ *runtime.ServeMux, _ runtime.Marshaler, w http.ResponseWriter, _ *http.Request, err error) {
			humanerror.WriteHTTP(w, err)
		}),
	)
	dialOpts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	if err := trackerv1.RegisterTrackerServiceHandlerFromEndpoint(ctx, mux, endpoint, dialOpts); err != nil {
		return nil, err
	}
	return mux, nil
}

func RegisterGateway(ctx context.Context, mux *http.ServeMux, endpoint string) error {
	gwMux, err := newGatewayMux(ctx, endpoint)
	if err != nil {
		return err
	}
	mux.Handle("/v1/", gwMux)
	return nil
}

func HealthzHTTP() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}
