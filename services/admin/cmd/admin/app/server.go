package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	adminapi "github.com/sedorofeevd/project-druzya/services/admin/internal/app/api/admin"
	"github.com/sedorofeevd/project-druzya/services/admin/internal/tools/ops"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// RunAPI starts HTTP gateway and gRPC server.
func RunAPI(ctx context.Context, a *App) error {
	grpcAddr := fmt.Sprintf("%s:%d", a.Config.GRPCHost, a.Config.GRPCPort)
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		return fmt.Errorf("listen grpc %s: %w", grpcAddr, err)
	}

	grpcSrv := grpc.NewServer(grpc.UnaryInterceptor(
		adminapi.AuthInterceptor(a.JWT, a.Config.AdminUserIDs),
	))
	adminapi.NewRegisteredImplementation(grpcSrv, a.Service)
	reflection.Register(grpcSrv)

	go func() {
		a.Logger.Info("grpc server starting", "addr", grpcAddr)
		if serveErr := grpcSrv.Serve(lis); serveErr != nil {
			a.Logger.Error("grpc server stopped", "err", serveErr)
		}
	}()

	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/healthz", ops.HealthzHandler())
	httpMux.HandleFunc("/readyz", ops.ReadyzHandler(
		func() error { return a.IdentityClient.Ping(context.Background()) },
		func() error { return a.ContentClient.Ping(context.Background()) },
		func() error { return a.BillingClient.Ping(context.Background()) },
		func() error { return a.AIClient.Ping(context.Background()) },
	))
	httpMux.Handle("/metrics", ops.MetricsHandler())

	if err := adminapi.RegisterGateway(ctx, httpMux, grpcAddr); err != nil {
		grpcSrv.Stop()
		return fmt.Errorf("register gateway: %w", err)
	}

	httpAddr := fmt.Sprintf(":%d", a.Config.HTTPPort)
	handler := ops.InstrumentHTTP("admin", ops.CORS(a.Config.CORSAllowedOrigins, httpMux))
	srv := &http.Server{
		Addr:              httpAddr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	a.Logger.Info("http server starting", "addr", httpAddr)

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.ListenAndServe()
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		grpcSrv.GracefulStop()
		return srv.Shutdown(shutdownCtx)
	case err := <-errCh:
		grpcSrv.Stop()
		if err == http.ErrServerClosed {
			return nil
		}
		return err
	}
}
