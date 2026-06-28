package adminapi

import (
	"context"

	aiadapter "github.com/sedorofeevd/project-druzya/services/admin/internal/adapter/ai"
	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// UpdateLLMConfig updates llm runtime config.
func (i *Implementation) UpdateLLMConfig(ctx context.Context, req *adminv1.UpdateLLMConfigRequest) (*adminv1.UpdateLLMConfigResponse, error) {
	cfg, err := i.service.UpdateLLMConfig(ctx, aiadapter.UpdateLLMConfigInput{
		ExpectedVersion:   req.GetExpectedVersion(),
		ChainOrder:        req.GetChainOrder(),
		TaskMapJSON:       req.GetTaskMapJson(),
		VirtualChainsJSON: req.GetVirtualChainsJson(),
	})
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.UpdateLLMConfigResponse{Config: toProtoLLMConfig(cfg)}, nil
}
