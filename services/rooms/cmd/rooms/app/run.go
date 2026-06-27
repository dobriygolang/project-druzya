package app

import (
	"context"
	"fmt"
	"log/slog"

	billingadapter "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/billing"
	billinggrpc "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/billing/grpc"
	identityadapter "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/identity"
	identitygrpc "github.com/sedorofeevd/project-druzya/services/rooms/internal/adapter/identity/grpc"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/config"
	roomrepo "github.com/sedorofeevd/project-druzya/services/rooms/internal/room/repository"
	roomservice "github.com/sedorofeevd/project-druzya/services/rooms/internal/room/service"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/rooms/internal/ws"
)

type App struct {
	Config       *config.Config
	Logger       logger.Logger
	Postgres     *roomrepo.Pool
	JWT          *jwt.Validator
	Hub          *ws.Hub
	Service      roomservice.Service
	billingConn  *billinggrpc.Client
	identityConn *identitygrpc.Client
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

	pg, err := roomrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	billingClient := billingadapter.Noop()
	var billingConn *billinggrpc.Client
	if cfg.BillingGRPCAddr != "" && cfg.InternalAPIToken != "" {
		billingConn, err = billinggrpc.NewClient(ctx, cfg.BillingGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			pg.Close()
			return nil, fmt.Errorf("init billing client: %w", err)
		}
		billingClient = billingConn
	}

	var identityClient identityadapter.TokenMinter
	var identityConn *identitygrpc.Client
	if cfg.IdentityGRPCAddr != "" && cfg.InternalAPIToken != "" {
		identityConn, err = identitygrpc.NewClient(ctx, cfg.IdentityGRPCAddr, cfg.InternalAPIToken)
		if err != nil {
			if billingConn != nil {
				_ = billingConn.Close()
			}
			pg.Close()
			return nil, fmt.Errorf("init identity client: %w", err)
		}
		identityClient = identityConn
	}

	repo := roomrepo.New(pg)
	hub := ws.NewHub(slog.Default())
	svc := roomservice.New(roomservice.Deps{
		Repo:          repo,
		Billing:       billingClient,
		Identity:      identityClient,
		PublicBaseURL: cfg.PublicBaseURL,
		RoomTTL:       cfg.RoomTTL,
		InviteSecret:  cfg.InviteSecret,
		InviteTTL:     cfg.InviteTTL,
		FreeMaxActive: cfg.FreeMaxActive,
	})

	return &App{
		Config:       cfg,
		Logger:       log,
		Postgres:     pg,
		JWT:          jwtValidator,
		Hub:          hub,
		Service:      svc,
		billingConn:  billingConn,
		identityConn: identityConn,
	}, nil
}

func (a *App) Close() {
	if a.Hub != nil {
		a.Hub.CloseAll()
	}
	if a.billingConn != nil {
		_ = a.billingConn.Close()
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
