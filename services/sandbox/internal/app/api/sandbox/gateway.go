package sandboxapi

import (
	"context"
	"net/http"

	sandboxv1 "github.com/sedorofeevd/project-druzya/services/sandbox/pkg/api/sandbox/v1"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/tools/humanerror"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
)

func newGatewayMux(ctx context.Context, endpoint string) (http.Handler, error) {
	mux := runtime.NewServeMux(
		runtime.WithMetadata(func(_ context.Context, r *http.Request) metadata.MD {
			if auth := r.Header.Get("Authorization"); auth != "" {
				return metadata.Pairs("authorization", auth)
			}
			return nil
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
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	if err := sandboxv1.RegisterSandboxServiceHandlerFromEndpoint(ctx, mux, endpoint, opts); err != nil {
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
