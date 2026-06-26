package app

import (
	"context"
	"fmt"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/adapter/postgres"
	domain "github.com/sedorofeevd/project-druzya/services/billing/internal/billing"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/config"
	"github.com/sedorofeevd/project-druzya/services/billing/internal/tools/logger"
)

// App holds adapters and the domain service for billing.
type App struct {
	Config   *config.Config
	Logger   logger.Logger
	Postgres *postgres.Pool
	Service  domain.Service
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

	pg, err := postgres.New(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	a := &App{
		Config:   cfg,
		Logger:   log,
		Postgres: pg,
	}

	a.Service = domain.NewService(pg, log)

	return a, nil
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
