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

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

// DockerRunner executes code in an isolated Docker container.
type DockerRunner struct {
	GoImage         string
	PythonImage     string
	JavaScriptImage string
	MaxOutputBytes  int
	CPUs            string
	// WorkRoot is a host-visible directory for bind mounts when sandbox uses
	// docker.sock from inside a container (must match a bind-mounted path).
	WorkRoot string
	// GoCacheDir is a host-visible persistent Go build cache (optional).
	GoCacheDir string
}

func (r *DockerRunner) Name() string { return "docker" }

func (r *DockerRunner) Run(ctx context.Context, req RunRequest) (*RunResult, error) {
	return runWithTests(ctx, req, r.Name(), r.runOnce)
}

func (r *DockerRunner) runOnce(ctx context.Context, req RunRequest, stdin, _ string) (*RunResult, error) {
	start := time.Now()
	workRoot := r.WorkRoot
	if workRoot == "" {
		workRoot = os.TempDir()
	}
	if err := os.MkdirAll(workRoot, 0o700); err != nil {
		return nil, err
	}
	dir, err := os.MkdirTemp(workRoot, "sandbox-docker-*")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(dir) }()

	filename, image, cmd, err := dockerLanguageSpec(req.Language, r)
	if err != nil {
		return &RunResult{Status: model.StatusInternalError, Error: err.Error(), RunnerName: r.Name()}, nil
	}
	if err := os.WriteFile(filepath.Join(dir, filename), []byte(req.Code), 0o600); err != nil {
		return nil, err
	}
	if isGoLanguage(req.Language) {
		if err := prepareGoWorkspace(dir); err != nil {
			return nil, err
		}
	}

	timeout := time.Duration(req.TimeoutMS) * time.Millisecond
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	runCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	containerName := fmt.Sprintf("sbx-%d", time.Now().UnixNano())
	// Killing the container on timeout/cleanup prevents orphaned containers when
	// the docker CLI process is terminated by the context.
	defer killContainer(containerName)

	args := dockerRunArgs(containerName, image, dir, goCacheDirForRun(r, req.Language), req.MemoryMB, r.CPUs, cmd...)
	command := exec.CommandContext(runCtx, "docker", args...)
	command.Stdin = strings.NewReader(stdin)

	var stdout, stderr bytes.Buffer
	command.Stdout = &stdout
	command.Stderr = &stderr
	runErr := command.Run()

	res := &RunResult{
		Stdout:     truncateOutput(stdout.String(), r.MaxOutputBytes),
		Stderr:     truncateOutput(stderr.String(), r.MaxOutputBytes),
		TimeMS:     int(time.Since(start).Milliseconds()),
		RunnerName: r.Name(),
	}

	if runCtx.Err() == context.DeadlineExceeded {
		res.Status = model.StatusTimeout
		return res, nil
	}
	if runErr != nil {
		combined := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
		if looksLikeCompileError(combined, req.Language) {
			res.Status = model.StatusCompileError
			res.CompileOutput = truncateOutput(combined, r.MaxOutputBytes)
			return res, nil
		}
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			code := exitErr.ExitCode()
			res.ExitCode = &code
		}
		res.Status = model.StatusRuntimeError
		if msg := strings.TrimSpace(stderr.String()); msg != "" {
			res.Error = msg
		} else {
			res.Error = runErr.Error()
		}
		return res, nil
	}
	code := 0
	res.ExitCode = &code
	res.Status = model.StatusSuccess
	return res, nil
}

func goCacheDirForRun(r *DockerRunner, language string) string {
	if !isGoLanguage(language) || r.GoCacheDir == "" {
		return ""
	}
	return r.GoCacheDir
}

func dockerRunArgs(name, image, workDir, goCacheDir string, memoryMB int, cpus string, cmd ...string) []string {
	if memoryMB <= 0 {
		memoryMB = 128
	}
	if cpus == "" {
		cpus = "1.0"
	}
	mem := fmt.Sprintf("%dm", memoryMB)
	gocacheEnv := "/work/.gocache"
	if goCacheDir != "" {
		gocacheEnv = goCacheDir
	}
	args := []string{
		"run", "--rm", "-i",
		"--name", name,
		"--network", "none",
		"--memory", mem,
		"--memory-swap", mem,
		"--cpus", cpus,
		"--pids-limit", "64",
		"--cap-drop", "ALL",
		"--security-opt", "no-new-privileges",
		// Read-only root with a small writable tmpfs; the code dir is the only
		// rw bind mount. Caches are redirected there so compilers can run.
		"--read-only",
		"--tmpfs", "/tmp:rw,size=64m,exec",
		"-e", "HOME=/work",
		"-e", "GOCACHE=" + gocacheEnv,
		"-v", workDir + ":/work:rw",
	}
	if goCacheDir != "" {
		args = append(args, "-v", goCacheDir+":"+goCacheDir+":rw")
	}
	args = append(args, "-w", "/work", image)
	return append(args, cmd...)
}

// killContainer best-effort removes a container that may have outlived the run.
func killContainer(name string) {
	killCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = exec.CommandContext(killCtx, "docker", "kill", name).Run()
}

func dockerLanguageSpec(language string, r *DockerRunner) (filename, image string, cmd []string, err error) {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case model.LangGo, "golang":
		return "main.go", r.GoImage, []string{"go", "run", "main.go"}, nil
	case model.LangPython:
		return "main.py", r.PythonImage, []string{"python3", "main.py"}, nil
	case model.LangJavaScript:
		return "main.js", r.JavaScriptImage, []string{"node", "main.js"}, nil
	default:
		return "", "", nil, fmt.Errorf("unsupported language: %s", language)
	}
}

func looksLikeCompileError(output, language string) bool {
	lower := strings.ToLower(output)
	switch strings.ToLower(strings.TrimSpace(language)) {
	case model.LangGo, "golang":
		return strings.Contains(lower, "syntax error") ||
			strings.Contains(lower, "cannot find") ||
			strings.Contains(lower, "undefined:") ||
			strings.Contains(lower, "build constraints exclude") ||
			strings.Contains(lower, "go.mod file not found")
	case model.LangPython:
		return strings.Contains(lower, "syntaxerror") ||
			strings.Contains(lower, "indentationerror") ||
			strings.Contains(lower, "nameerror")
	case model.LangJavaScript:
		return strings.Contains(lower, "syntaxerror") ||
			strings.Contains(lower, "referenceerror")
	default:
		return false
	}
}
