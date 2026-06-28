package aiapi

import (
	"context"
	"errors"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig"
	llmconfigservice "github.com/sedorofeevd/project-druzya/services/ai/internal/llmconfig/service"
)

// GetLLMConfig returns the current llm runtime config snapshot.
func (i *Implementation) GetLLMConfig(ctx context.Context, _ *aiv1.GetLLMConfigRequest) (*aiv1.GetLLMConfigResponse, error) {
	view, err := i.llmConfig.Get(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &aiv1.GetLLMConfigResponse{Config: toProtoLLMConfig(view)}, nil
}

// UpdateLLMConfig updates llm runtime config with optimistic locking.
func (i *Implementation) UpdateLLMConfig(ctx context.Context, req *aiv1.UpdateLLMConfigRequest) (*aiv1.UpdateLLMConfigResponse, error) {
	view, err := i.llmConfig.Update(ctx, llmconfigservice.UpdateInput{
		ExpectedVersion:   req.GetExpectedVersion(),
		ChainOrder:        req.GetChainOrder(),
		TaskMapJSON:       req.GetTaskMapJson(),
		VirtualChainsJSON: req.GetVirtualChainsJson(),
	})
	if err != nil {
		if errors.Is(err, llmconfigservice.ErrVersionConflict) {
			return nil, failedPrecondition("config version conflict — reload and retry")
		}
		return nil, mapServiceError(err)
	}
	return &aiv1.UpdateLLMConfigResponse{Config: toProtoLLMConfig(view)}, nil
}

func toProtoLLMConfig(view llmconfig.View) *aiv1.LLMRuntimeConfig {
	return &aiv1.LLMRuntimeConfig{
		Version:           view.Version,
		ChainOrder:        append([]string(nil), view.ChainOrder...),
		TaskMapJson:       view.TaskMapJSON,
		VirtualChainsJson: view.VirtualChainsJSON,
	}
}
