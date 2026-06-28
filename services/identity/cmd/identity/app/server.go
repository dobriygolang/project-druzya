package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	identityapi "github.com/sedorofeevd/project-druzya/services/identity/internal/app/api/identity"
	"github.com/sedorofeevd/project-druzya/services/identity/internal/tools/ops"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// RunAPI starts HTTP gateway, custom HTTP routes, and gRPC server.
func RunAPI(ctx context.Context, a *App) error {
	listenAddr := fmt.Sprintf("%s:%d", a.Config.GRPCHost, a.Config.GRPCPort)
	dialAddr := fmt.Sprintf("127.0.0.1:%d", a.Config.GRPCPort)
	lis, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen grpc %s: %w", listenAddr, err)
	}

	impl := identityapi.NewImplementation(a.Service)
	grpcSrv := grpc.NewServer(grpc.ChainUnaryInterceptor(
		identityapi.InternalAuthInterceptor(a.Config.InternalAPIToken),
		identityapi.AuthInterceptor(a.Service),
	))
	identityapi.Register(grpcSrv, impl)

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
		ops.PingRedis(a.Redis.Client),
	))
	httpMux.Handle("/metrics", ops.MetricsHandler())
	httpMux.HandleFunc("/v1/auth/yandex/callback", impl.YandexCallbackHTTP())
	httpMux.HandleFunc("/v1/auth/config", identityapi.AuthConfigHTTP(a.Config.TelegramBotUsername))
	httpMux.HandleFunc("/v1/jwt/public.pem", impl.PublicKeyHTTP(a.PublicKeyPEM))

	if err := identityapi.RegisterGateway(ctx, httpMux, dialAddr); err != nil {
		grpcSrv.Stop()
		return fmt.Errorf("register gateway: %w", err)
	}

	httpAddr := fmt.Sprintf(":%d", a.Config.HTTPPort)
	handler := ops.InstrumentHTTP("identity", httpMux)
	handler = ops.CORS(a.Config.CORSAllowedOrigins, handler)
	handler = ops.AuthRateLimit(a.Config.AuthRateLimitPerMinute, handler)
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
