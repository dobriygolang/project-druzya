package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	interviewapi "github.com/sedorofeevd/project-druzya/services/interview/internal/app/api/interview"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/sessioncleanup"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/ops"
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
		interviewapi.AuthInterceptor(a.JWT),
		interviewapi.InternalAuthInterceptor(a.Config.InternalAPIToken),
		interviewapi.CorrelationInterceptor(),
	))
	interviewapi.NewRegisteredImplementation(grpcSrv, a.Service)
	reflection.Register(grpcSrv)

	go sessioncleanup.Run(ctx, a.Logger, a.Service, a.Config.SessionCleanupEvery)

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
		func(ctx context.Context) error { return a.ContentClient.Ping(ctx) },
	))
	httpMux.Handle("/metrics", ops.MetricsHandler())

	if err := interviewapi.RegisterGateway(ctx, httpMux, dialAddr); err != nil {
		grpcSrv.Stop()
		return fmt.Errorf("register gateway: %w", err)
	}

	httpAddr := fmt.Sprintf(":%d", a.Config.HTTPPort)
	handler := ops.InstrumentHTTP("interview", httpMux)
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
