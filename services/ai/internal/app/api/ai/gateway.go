package aiapi

import (
	"context"
	"net/http"
	"strings"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/humanerror"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

const internalServicePrefix = "/ai.v1.AiInternalService/"

func newGatewayMux(ctx context.Context, endpoint string) (http.Handler, error) {
	mux := runtime.NewServeMux(
		runtime.WithIncomingHeaderMatcher(func(key string) (string, bool) {
			if strings.EqualFold(key, "x-internal-token") {
				return "x-internal-token", true
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
		}),
	)

	dialOpts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithUnaryInterceptor(func(
			ctx context.Context,
			method string,
			req, reply any,
			cc *grpc.ClientConn,
			invoker grpc.UnaryInvoker,
			opts ...grpc.CallOption,
		) error {
			if token := InternalTokenFromContext(ctx); token != "" {
				ctx = metadata.AppendToOutgoingContext(ctx, "x-internal-token", token)
			}
			return invoker(ctx, method, req, reply, cc, opts...)
		}),
	}
	if err := aiv1.RegisterAiInternalServiceHandlerFromEndpoint(ctx, mux, endpoint, dialOpts); err != nil {
		return nil, err
	}

	return mux, nil
}

// RegisterGateway mounts generated grpc-gateway handlers via local gRPC endpoint.
func RegisterGateway(ctx context.Context, mux *http.ServeMux, endpoint string) error {
	gwMux, err := newGatewayMux(ctx, endpoint)
	if err != nil {
		return err
	}
	mux.Handle("/v1/", gwMux)
	return nil
}

// HealthzHTTP returns service health.
func HealthzHTTP() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}
}
