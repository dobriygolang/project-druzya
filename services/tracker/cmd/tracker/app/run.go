package app

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	trackerapi "github.com/sedorofeevd/project-druzya/services/tracker/internal/app/api/tracker"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/config"
	googleadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/google"
	identityadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/identity"
	identitygrpc "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/identity/grpc"
	recommendationadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/recommendation"
	recommendationgrpc "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/recommendation/grpc"
	trackerrepo "github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
	trackerservice "github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/service"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type App struct {
	Config             *config.Config
	Logger             logger.Logger
	Postgres           *trackerrepo.Pool
	JWT                *jwt.Validator
	Service            trackerservice.Service
	recommendationConn *recommendationgrpc.Client
	identityConn       *identitygrpc.Client
}

func New(ctx context.Context) (*App, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, fmt.Errorf("load config: %w", err)
	}
	log, err := logger.New(cfg.LogLevel)
	if err != nil {
		return nil, fmt.Errorf("init logger: %w", err)
	}
	jwtValidator, err := jwt.NewValidator(cfg.JWTPublicKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("init jwt validator: %w", err)
	}
	pg, err := trackerrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}
	repo := trackerrepo.New(pg)
	googleClient := googleadapter.NewClient(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURI)
	var recommendationClient recommendationadapter.Client
	var recommendationConn *recommendationgrpc.Client
	if cfg.RecommendationGRPCAddr != "" {
		recommendationConn, err = recommendationgrpc.NewClient(ctx, cfg.RecommendationGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			pg.Close()
			return nil, fmt.Errorf("init recommendation client: %w", err)
		}
		recommendationClient = recommendationConn
	}
	var identityClient identityadapter.Client
	var identityConn *identitygrpc.Client
	if cfg.IdentityGRPCAddr != "" {
		identityConn, err = identitygrpc.NewClient(ctx, cfg.IdentityGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			if recommendationConn != nil {
				_ = recommendationConn.Close()
			}
			pg.Close()
			return nil, fmt.Errorf("init identity client: %w", err)
		}
		identityClient = identityConn
	}
	svc := trackerservice.New(trackerservice.Deps{
		Repo:           repo,
		Google:         googleClient,
		FrontendURL:    cfg.FrontendURL,
		Recommendation: recommendationClient,
		Identity:       identityClient,
	})
	return &App{Config: cfg, Logger: log, Postgres: pg, JWT: jwtValidator, Service: svc, recommendationConn: recommendationConn, identityConn: identityConn}, nil
}

func (a *App) Close() {
	if a.recommendationConn != nil {
		_ = a.recommendationConn.Close()
	}
	if a.identityConn != nil {
		_ = a.identityConn.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}

func RunAPI(ctx context.Context, a *App) error {
	listenAddr := fmt.Sprintf("%s:%d", a.Config.GRPCHost, a.Config.GRPCPort)
	dialAddr := fmt.Sprintf("127.0.0.1:%d", a.Config.GRPCPort)
	lis, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return fmt.Errorf("listen grpc %s: %w", listenAddr, err)
	}
	grpcSrv := grpc.NewServer(grpc.ChainUnaryInterceptor(
		trackerapi.AuthInterceptor(a.JWT),
		trackerapi.InternalAuthInterceptor(a.Config.InternalAPIToken),
	))
	trackerapi.NewRegisteredImplementation(grpcSrv, a.Service)
	reflection.Register(grpcSrv)
	go func() {
		a.Logger.Info("grpc server starting", "addr", listenAddr)
		if serveErr := grpcSrv.Serve(lis); serveErr != nil {
			a.Logger.Error("grpc server stopped", "err", serveErr)
		}
	}()
	impl := trackerapi.NewImplementation(a.Service)
	httpMux := http.NewServeMux()
	httpMux.HandleFunc("/healthz", trackerapi.HealthzHTTP())
	httpMux.HandleFunc("/v1/tracker/integrations/google/callback", impl.GoogleCallbackHTTP())
	if err := trackerapi.RegisterGateway(ctx, httpMux, dialAddr); err != nil {
		grpcSrv.Stop()
		return fmt.Errorf("register gateway: %w", err)
	}
	httpAddr := fmt.Sprintf(":%d", a.Config.HTTPPort)
	srv := &http.Server{Addr: httpAddr, Handler: httpMux, ReadHeaderTimeout: 5 * time.Second}
	a.Logger.Info("http server starting", "addr", httpAddr)
	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()
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
