package runner

import (
	"fmt"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/config"
)

// NewFromConfig selects a CodeRunner implementation.
func NewFromConfig(cfg *config.Config) (CodeRunner, error) {
	switch cfg.RunnerMode {
	case "process":
		return &ProcessRunner{MaxOutputBytes: cfg.MaxOutputBytes}, nil
	case "docker":
		return &DockerRunner{
			GoImage: cfg.DockerGoImage, PythonImage: cfg.DockerPythonImage,
			JavaScriptImage: cfg.DockerNodeImage, MaxOutputBytes: cfg.MaxOutputBytes,
			CPUs: cfg.DefaultCPUs, WorkRoot: cfg.DockerWorkRoot,
		}, nil
	case "fake", "":
		return DefaultFakeRunner(), nil
	default:
		return nil, fmt.Errorf("unknown RUNNER_MODE: %s", cfg.RunnerMode)
	}
}
