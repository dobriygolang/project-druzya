package app

import (
	"context"
	"fmt"

	focusrepo "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/repository"
	focusservice "github.com/sedorofeevd/project-druzya/services/focus/internal/focus/service"
	"github.com/sedorofeevd/project-druzya/services/focus/internal/config"
	"github.com/sedorofeevd/project-druzya/services/focus/internal/tools/logger"
	"github.com/sedorofeevd/project-druzya/services/identity/pkg/jwt"
)

// App holds adapters and the domain service.
type App struct {
	Config   *config.Config
	Logger   logger.Logger
	Postgres *focusrepo.Pool
	JWT      *jwt.Validator
	Service  focusservice.Service
}

// New wires adapters and the domain service.
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

	pg, err := focusrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	repo := focusrepo.New(pg)
	svc := focusservice.New(focusservice.Deps{Repo: repo})

	return &App{
		Config:   cfg,
		Logger:   log,
		Postgres: pg,
		JWT:      jwtValidator,
		Service:  svc,
	}, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
