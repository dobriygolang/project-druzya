package aiapi

import (
	"context"

	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/llm/llmchain"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// ProbeLLMProviders live-probes free and pro provider chains.
func (i *Implementation) ProbeLLMProviders(ctx context.Context, _ *aiv1.ProbeLLMProvidersRequest) (*aiv1.ProbeLLMProvidersResponse, error) {
	if i.chains == nil || i.chains.Free == nil {
		return nil, status.Error(codes.FailedPrecondition, "llm chain not configured")
	}
	probeCtx, cancel := context.WithTimeout(ctx, llmchain.ProbeTimeout)
	defer cancel()
	results := i.chains.ProbeAll(probeCtx)
	out := &aiv1.ProbeLLMProvidersResponse{
		Probes: make([]*aiv1.LLMProviderProbe, 0, len(results)),
	}
	for _, item := range results {
		probe := &aiv1.LLMProviderProbe{
			Provider:   string(item.Provider),
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
