package runner

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

// ProcessRunner executes code in a subprocess with temp dir isolation.
// Intended for local dev only (RUNNER_MODE=process).
type ProcessRunner struct {
	MaxOutputBytes int
}

func (r *ProcessRunner) Name() string { return "process" }

// Run executes code once or per test case.
func (r *ProcessRunner) Run(ctx context.Context, req RunRequest) (*RunResult, error) {
	return runWithTests(ctx, req, r.Name(), r.runOnce)
}

func (r *ProcessRunner) runOnce(ctx context.Context, req RunRequest, stdin, testName string) (*RunResult, error) {
	start := time.Now()
	dir, err := os.MkdirTemp("", "sandbox-run-*")
	if err != nil {
		return nil, err
	}
	defer func() { _ = os.RemoveAll(dir) }()

	filename, cmdArgs, compileArgs, err := languageSpec(req.Language, dir)
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

	if compileArgs != nil {
		compile := exec.CommandContext(runCtx, compileArgs[0], compileArgs[1:]...)
		compile.Dir = dir
		compile.Env = minimalEnv(dir)
		out, err := compile.CombinedOutput()
		if err != nil {
			return &RunResult{
				Status:        model.StatusCompileError,
				CompileOutput: truncateOutput(string(out), r.MaxOutputBytes),
				TimeMS:        int(time.Since(start).Milliseconds()),
				RunnerName:    r.Name(),
			}, nil
		}
	}

	cmd := exec.CommandContext(runCtx, cmdArgs[0], cmdArgs[1:]...)
	cmd.Dir = dir
	cmd.Env = minimalEnv(dir)
	cmd.Stdin = strings.NewReader(stdin)

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	runErr := cmd.Run()

	res := &RunResult{
		Stdout:     truncateOutput(stdout.String(), r.MaxOutputBytes),
		Stderr:     truncateOutput(stderr.String(), r.MaxOutputBytes),
		TimeMS:     int(time.Since(start).Milliseconds()),
		RunnerName: r.Name(),
	}
	if testName != "" {
		_ = testName
	}

	if runCtx.Err() == context.DeadlineExceeded {
		res.Status = model.StatusTimeout
		return res, nil
	}
	if runErr != nil {
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			code := exitErr.ExitCode()
			res.ExitCode = &code
		}
		res.Status = model.StatusRuntimeError
		res.Error = runErr.Error()
		return res, nil
	}
	code := 0
	res.ExitCode = &code
	res.Status = model.StatusSuccess
	return res, nil
}

func languageSpec(language, dir string) (filename string, runArgs, compileArgs []string, err error) {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case model.LangGo, "golang":
		return "main.go", []string{"go", "run", "main.go"}, nil, nil
	case model.LangPython:
		return "main.py", []string{"python3", "main.py"}, nil, nil
	case model.LangJavaScript:
		return "main.js", []string{"node", "main.js"}, nil, nil
	default:
		return "", nil, nil, fmt.Errorf("unsupported language: %s", language)
	}
}

func minimalEnv(workDir string) []string {
	return []string{
		"PATH=" + os.Getenv("PATH"),
		"HOME=" + workDir,
		"TMPDIR=" + workDir,
		"GOCACHE=" + filepath.Join(workDir, ".gocache"),
		"GOTMPDIR=" + workDir,
	}
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func intPtr(v int) *int { return &v }
