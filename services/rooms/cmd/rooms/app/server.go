package app

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	roomsapi "github.com/sedorofeevd/project-druzya/services/rooms/internal/app/api/rooms"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/room/archive"
	roomrepo "github.com/sedorofeevd/project-druzya/services/rooms/internal/room/repository"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/ws"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

func RunAPI(ctx context.Context, a *App) error {
	grpcAddr := fmt.Sprintf("127.0.0.1:%d", a.Config.GRPCPort)
	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		return fmt.Errorf("listen grpc %s: %w", grpcAddr, err)
	}

	grpcSrv := grpc.NewServer(grpc.UnaryInterceptor(roomsapi.AuthInterceptor(a.JWT)))
	roomsapi.NewRegisteredImplementation(grpcSrv, a.Service, a.Hub)
	reflection.Register(grpcSrv)

	go func() {
		a.Logger.Info("grpc server starting", "addr", grpcAddr)
		if serveErr := grpcSrv.Serve(lis); serveErr != nil {
			a.Logger.Error("grpc server stopped", "err", serveErr)
		}
	}()

	repo := roomrepo.New(a.Postgres)
	wsHandler := ws.NewHandler(a.Hub, a.JWT, repo, slog.Default())

	go archive.Run(ctx, repo, a.Config.RoomArchiveInterval, a.Logger)

	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/healthz", roomsapi.HealthzHTTP())
	httpMux.Handle("GET /ws/editor/{roomId}", wsHandler)

	if err := roomsapi.RegisterGateway(ctx, httpMux, grpcAddr); err != nil {
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
		a.Hub.CloseAll()
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
