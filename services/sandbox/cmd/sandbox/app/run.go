package app

import (
	"context"
	"fmt"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/adapter/queue"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/config"
	domain "github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox"
	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/tools/logger"
)

// App holds adapters and the domain service for sandbox.
type App struct {
	Config  *config.Config
	Logger  logger.Logger
	Queue   queue.Broker
	Service domain.Service
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

	q, err := queue.New(ctx, cfg.QueueURL)
	if err != nil {
		return nil, fmt.Errorf("init queue: %w", err)
	}

	a := &App{
		Config: cfg,
		Logger: log,
		Queue:  q,
	}

	a.Service = domain.NewService(q, log)

	return a, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.Queue != nil {
		a.Queue.Close()
	}
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
