package runner

import (
	"context"
	"os/exec"
	"time"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/tools/logger"
)

// WarmDockerImages pre-pulls runtime images in the background so the first
// user Run is not blocked on a cold docker pull.
func WarmDockerImages(ctx context.Context, log logger.Logger, images ...string) {
	if len(images) == 0 {
		return
	}
	go func() {
		for _, image := range images {
			if image == "" {
				continue
			}
			pullCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
			cmd := exec.CommandContext(pullCtx, "docker", "pull", image)
			out, err := cmd.CombinedOutput()
			cancel()
			if err != nil {
				log.Warn("docker image pull failed", "image", image, "err", err, "output", string(out))
				continue
			}
			log.Info("docker image ready", "image", image)
		}
	}()
}
