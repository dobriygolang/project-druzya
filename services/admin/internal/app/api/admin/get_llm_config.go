package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// GetLLMConfig returns current llm runtime config.
func (i *Implementation) GetLLMConfig(ctx context.Context, _ *adminv1.GetLLMConfigRequest) (*adminv1.GetLLMConfigResponse, error) {
	cfg, err := i.service.GetLLMConfig(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &adminv1.GetLLMConfigResponse{Config: toProtoLLMConfig(cfg)}, nil
}
