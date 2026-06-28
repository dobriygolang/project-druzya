package runner

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const formatTimeout = 15 * time.Second

func (r *DockerRunner) Format(ctx context.Context, language, code string) (string, error) {
	if !isGoLanguage(language) {
		return "", fmt.Errorf("format not supported for language: %s", language)
	}
	workRoot := r.WorkRoot
	if workRoot == "" {
		workRoot = os.TempDir()
	}
	if err := os.MkdirAll(workRoot, 0o700); err != nil {
		return "", err
	}
	dir, err := os.MkdirTemp(workRoot, "sandbox-format-*")
	if err != nil {
		return "", err
	}
	defer func() { _ = os.RemoveAll(dir) }()

	if err := os.WriteFile(filepath.Join(dir, "main.go"), []byte(code), 0o600); err != nil {
		return "", err
	}

	runCtx, cancel := context.WithTimeout(ctx, formatTimeout)
	defer cancel()

	name := fmt.Sprintf("sbx-fmt-%d", time.Now().UnixNano())
	defer killContainer(name)

	args := dockerRunArgs(name, r.GoImage, dir, goCacheDirForRun(r, language), 256, r.CPUs, "gofmt", "main.go")
	cmd := exec.CommandContext(runCtx, "docker", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = strings.TrimSpace(stdout.String())
		}
		if msg == "" {
			msg = err.Error()
		}
		return "", fmt.Errorf("gofmt: %s", msg)
	}
	return stdout.String(), nil
}

func (r *ProcessRunner) Format(ctx context.Context, language, code string) (string, error) {
	if !isGoLanguage(language) {
		return "", fmt.Errorf("format not supported for language: %s", language)
	}
	runCtx, cancel := context.WithTimeout(ctx, formatTimeout)
	defer cancel()

	cmd := exec.CommandContext(runCtx, "gofmt")
	cmd.Stdin = strings.NewReader(code)
	out, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			msg := strings.TrimSpace(string(exitErr.Stderr))
			if msg != "" {
				return "", fmt.Errorf("gofmt: %s", msg)
			}
		}
		return "", fmt.Errorf("gofmt: %w", err)
	}
	return string(out), nil
}

func (r *FakeCodeRunner) Format(_ context.Context, language, code string) (string, error) {
	if !isGoLanguage(language) {
		return "", fmt.Errorf("format not supported for language: %s", language)
	}
	return code, nil
}
