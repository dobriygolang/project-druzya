package adminapi

import (
	"context"
	"net/http"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/sedorofeevd/project-druzya/services/admin/internal/tools/humanerror"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func newGatewayMux(ctx context.Context, endpoint string) (http.Handler, error) {
	mux := runtime.NewServeMux(
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

	dialOpts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	if err := adminv1.RegisterAdminServiceHandlerFromEndpoint(ctx, mux, endpoint, dialOpts); err != nil {
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
	mux.Handle("/v1/admin/", gwMux)
	return nil
}
