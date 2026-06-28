package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	billingapi "github.com/sedorofeevd/project-druzya/services/billing/internal/app/api/billing"
	billingrepo "github.com/sedorofeevd/project-druzya/services/billing/internal/billing/repository"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/ops"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// RunAPI starts HTTP gateway and gRPC server.
func RunAPI(ctx context.Context, a *App) error {
	listenAddr := fmt.Sprintf("%s:%d", a.Config.GRPCHost, a.Config.GRPCPort)
	dialAddr := fmt.Sprintf("127.0.0.1:%d", a.Config.GRPCPort)
	lis, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen grpc %s: %w", listenAddr, err)
	}

	grpcSrv := grpc.NewServer(grpc.ChainUnaryInterceptor(
		billingapi.AuthInterceptor(a.JWT),
		billingapi.InternalAuthInterceptor(a.Config.InternalAPIToken),
	))
	billingapi.NewRegisteredImplementation(
		grpcSrv,
		a.Service,
		billingrepo.New(a.Postgres),
		a.Postgres,
		billingapi.CheckoutFromConfig(a.Config.TributeCheckout),
	)
	reflection.Register(grpcSrv)

	go func() {
		a.Logger.Info("grpc server starting", "addr", listenAddr)
		if serveErr := grpcSrv.Serve(lis); serveErr != nil {
			a.Logger.Error("grpc server stopped", "err", serveErr)
		}
	}()

	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/healthz", ops.HealthzHandler())
	httpMux.HandleFunc("/readyz", ops.ReadyzHandler(
		ops.PingPostgres(a.Postgres.Pool),
	))
	httpMux.Handle("/metrics", ops.MetricsHandler())

	if err := billingapi.RegisterGateway(ctx, httpMux, dialAddr); err != nil {
		grpcSrv.Stop()
		return fmt.Errorf("register gateway: %w", err)
	}
	httpMux.HandleFunc("/v1/billing/webhooks/tribute", billingapi.TributeWebhookHandler(a.Service))

	httpAddr := fmt.Sprintf(":%d", a.Config.HTTPPort)
	handler := ops.InstrumentHTTP("billing", httpMux)
	handler = ops.CORS(a.Config.CORSAllowedOrigins, handler)
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
