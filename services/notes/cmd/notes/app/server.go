package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	notesapi "github.com/sedorofeevd/project-druzya/services/notes/internal/app/api/notes"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func RunAPI(ctx context.Context, a *App) error {
	listenAddr := fmt.Sprintf("%s:%d", a.Config.GRPCHost, a.Config.GRPCPort)
	dialAddr := fmt.Sprintf("127.0.0.1:%d", a.Config.GRPCPort)
	lis, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen grpc %s: %w", listenAddr, err)
	}

	grpcSrv := grpc.NewServer(grpc.ChainUnaryInterceptor(
		notesapi.AuthInterceptor(a.JWT),
	))
	notesapi.NewRegisteredImplementation(grpcSrv, a.Service)
	reflection.Register(grpcSrv)

	go func() {
		a.Logger.Info("grpc server starting", "addr", listenAddr)
		if serveErr := grpcSrv.Serve(lis); serveErr != nil {
			a.Logger.Error("grpc server stopped", "err", serveErr)
		}
	}()

	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/healthz", notesapi.HealthzHTTP())

	if err := notesapi.RegisterGateway(ctx, httpMux, dialAddr); err != nil {
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
