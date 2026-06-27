package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	identityapi "github.com/sedorofeevd/project-druzya/services/identity/internal/app/api/identity"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

// RunAPI starts HTTP gateway, custom HTTP routes, and gRPC server.
func RunAPI(ctx context.Context, a *App) error {
	grpcAddr := fmt.Sprintf("127.0.0.1:%d", a.Config.GRPCPort)
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		return fmt.Errorf("listen grpc %s: %w", grpcAddr, err)
	}

	impl := identityapi.NewImplementation(a.Service)
	grpcSrv := grpc.NewServer(grpc.ChainUnaryInterceptor(identityapi.AuthInterceptor(a.Service)))
	identityapi.Register(grpcSrv, impl)

	reflection.Register(grpcSrv)

	go func() {
		a.Logger.Info("grpc server starting", "addr", grpcAddr)
		if serveErr := grpcSrv.Serve(lis); serveErr != nil {
			a.Logger.Error("grpc server stopped", "err", serveErr)
		}
	}()

	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/healthz", identityapi.HealthzHTTP())
	httpMux.HandleFunc("/v1/auth/yandex/callback", impl.YandexCallbackHTTP())
	httpMux.HandleFunc("/v1/jwt/public.pem", impl.PublicKeyHTTP(a.PublicKeyPEM))

	if err := identityapi.RegisterGateway(ctx, httpMux, grpcAddr); err != nil {
		grpcSrv.Stop()
		return fmt.Errorf("register gateway: %w", err)
	}

	httpAddr := fmt.Sprintf(":%d", a.Config.HTTPPort)
	srv := &http.Server{
		Addr:              httpAddr,
		Handler:           httpMux,
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
