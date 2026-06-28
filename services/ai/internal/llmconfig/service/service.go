package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig"
	llmconfigrepo "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/repository"
)

// ErrInvalidInput marks malformed admin input.
var ErrInvalidInput = errors.New("invalid input")

// ErrVersionConflict marks optimistic lock failure.
var ErrVersionConflict = llmconfigrepo.ErrVersionConflict

// Store persists runtime config.
type Store interface {
	Load(ctx context.Context) (*llmchain.RuntimeConfig, error)
	Save(ctx context.Context, cfg *llmchain.RuntimeConfig, expectedVersion int64) error
}

// Reloader forces llmchain to reload runtime config.
type Reloader interface {
	RuntimeForceReload(ctx context.Context)
}

// UpdateInput is an admin config write payload.
type UpdateInput struct {
	ExpectedVersion   int64
	ChainOrder        []string
	TaskMapJSON       string
	VirtualChainsJSON string
}

// Service manages llm runtime config for admin APIs.
type Service interface {
	Get(ctx context.Context) (llmconfig.View, error)
	Update(ctx context.Context, input UpdateInput) (llmconfig.View, error)
}

type llmConfigService struct {
	repo     Store
	reloader Reloader
}

// Deps wires llm config service dependencies.
type Deps struct {
	Repo     Store
	Reloader Reloader
}

// New constructs llm config service.
func New(deps Deps) Service {
	return &llmConfigService{repo: deps.Repo, reloader: deps.Reloader}
}

func (s *llmConfigService) Get(ctx context.Context) (llmconfig.View, error) {
	cfg, err := s.repo.Load(ctx)
	if err != nil {
		return llmconfig.View{}, err
	}
	return llmconfig.ViewFromRuntime(cfg), nil
}

func (s *llmConfigService) Update(ctx context.Context, input UpdateInput) (llmconfig.View, error) {
	if input.ExpectedVersion < 0 {
		return llmconfig.View{}, fmt.Errorf("expected_version required: %w", ErrInvalidInput)
	}
	cfg, err := llmconfig.RuntimeFromUpdate(
		input.ExpectedVersion+1,
		input.ChainOrder,
		input.TaskMapJSON,
		input.VirtualChainsJSON,
	)
	if err != nil {
		return llmconfig.View{}, fmt.Errorf("%w: %w", ErrInvalidInput, err)
	}
	if err := s.repo.Save(ctx, cfg, input.ExpectedVersion); err != nil {
		return llmconfig.View{}, err
	}
	if s.reloader != nil {
		s.reloader.RuntimeForceReload(ctx)
	}
	loaded, err := s.repo.Load(ctx)
	if err != nil {
		return llmconfig.View{}, err
	}
	return llmconfig.ViewFromRuntime(loaded), nil
}
