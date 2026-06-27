package app

import (
	"context"
	"fmt"

	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
	catalogservice "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/service"
	"github.com/sedorofeevd/project-druzya/services/content/internal/config"
	"github.com/sedorofeevd/project-druzya/services/content/internal/tools/logger"
)

// App holds adapters and the domain service for content.
type App struct {
	Config   *config.Config
	Logger   logger.Logger
	Postgres *catalogrepo.Pool
	Service  catalogservice.Service
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

	pg, err := catalogrepo.NewPool(ctx, cfg.PostgresDSN)
	if err != nil {
		return nil, fmt.Errorf("init postgres: %w", err)
	}

	repo := catalogrepo.New(pg)
	svc := catalogservice.New(catalogservice.Deps{Repo: repo})

	return &App{
		Config:   cfg,
		Logger:   log,
		Postgres: pg,
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
