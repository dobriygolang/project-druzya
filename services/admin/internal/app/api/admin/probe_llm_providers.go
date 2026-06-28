package adminapi

import (
	"context"

	adminv1 "github.com/sedorofeevd/project-druzya/services/admin/pkg/api/admin/v1"
)

// ProbeLLMProviders live-probes each provider in the configured LLM chain.
func (i *Implementation) ProbeLLMProviders(ctx context.Context, _ *adminv1.ProbeLLMProvidersRequest) (*adminv1.ProbeLLMProvidersResponse, error) {
	probes, err := i.service.ProbeLLMProviders(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := &adminv1.ProbeLLMProvidersResponse{
		Probes: make([]*adminv1.LLMProviderProbe, 0, len(probes)),
	}
	for _, item := range probes {
		probe := &adminv1.LLMProviderProbe{
			Provider:   item.Provider,
			Model:      item.Model,
			Registered: item.Registered,
			Ok:         item.OK,
			LatencyMs:  item.LatencyMs,
		}
		if item.Error != "" {
			probe.Error = &item.Error
		}
		out.Probes = append(out.Probes, probe)
	}
	return out, nil
}
