package app

import (
	"context"
	"fmt"
	domain "github.com/sedorofeevd/project-druzya/services/ai/internal/ai"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/config"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/tools/logger"
)

// App holds adapters and the domain service for ai.
type App struct {
	Config  *config.Config
	Logger  logger.Logger
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

	a := &App{
		Config: cfg,
		Logger: log,
	}

	a.Service = domain.NewService(log)

	return a, nil
}

// Close releases adapter resources.
func (a *App) Close() {
	if a.Logger != nil {
		_ = a.Logger.Sync()
	}
}
