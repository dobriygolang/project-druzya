package app

import (
	"context"
	"fmt"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/postgres"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/queue"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/config"
	domain "github.com/sedorofeevd/project-druzya/services/interview/internal/interview"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/tools/logger"
)

// App holds adapters and the domain service for interview.
type App struct {
	Config   *config.Config
	Logger   logger.Logger
	Postgres *postgres.Pool
	Queue    queue.Broker
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
	q, err := queue.New(ctx, cfg.QueueURL)
	if err != nil {
		pg.Close()
		return nil, fmt.Errorf("init queue: %w", err)
	}

	a := &App{
		Config:   cfg,
		Logger:   log,
		Postgres: pg,
		Queue:    q,
	}

	a.Service = domain.NewService(pg, q, log)

	return a, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.Queue != nil {
		a.Queue.Close()
	}
	if a.Postgres != nil {
		a.Postgres.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
