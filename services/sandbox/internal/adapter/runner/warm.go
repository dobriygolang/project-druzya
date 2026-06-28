package runner

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
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

// WarmGoCompiler runs a one-off Go compile so the shared GOCACHE is hot before
// the first user request (cold compile can exceed the default run timeout).
func WarmGoCompiler(ctx context.Context, log logger.Logger, r *DockerRunner) {
	if r == nil || r.GoImage == "" {
		return
	}
	go func() {
		workRoot := r.WorkRoot
		if workRoot == "" {
			workRoot = os.TempDir()
		}
		if err := os.MkdirAll(workRoot, 0o700); err != nil {
			log.Warn("go warm-up work root failed", "err", err)
			return
		}
		if r.GoCacheDir != "" {
			if err := os.MkdirAll(r.GoCacheDir, 0o700); err != nil {
				log.Warn("go warm-up cache dir failed", "err", err)
				return
			}
		}
		dir, err := os.MkdirTemp(workRoot, "sandbox-warm-*")
		if err != nil {
			log.Warn("go warm-up temp dir failed", "err", err)
			return
		}
		defer func() { _ = os.RemoveAll(dir) }()

		if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte("package main\nfunc main(){}\n"), 0o600); err != nil {
			log.Warn("go warm-up write failed", "err", err)
			return
		}
		if err := prepareGoWorkspace(dir); err != nil {
			log.Warn("go warm-up workspace failed", "err", err)
			return
		}

		warmCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		defer cancel()
		name := fmt.Sprintf("sbx-warm-%d", time.Now().UnixNano())
		args := dockerRunArgs(name, r.GoImage, dir, goCacheDirForRun(r, "go"), 128, r.CPUs, "go", "run", "main.go")
		out, err := exec.CommandContext(warmCtx, "docker", args...).CombinedOutput()
		if err != nil {
			log.Warn("go warm-up compile failed", "err", err, "output", string(out))
			return
		}
		log.Info("go compiler cache warmed")
	}()
}
