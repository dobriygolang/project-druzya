package runner

import (
	"strings"
	"testing"
)

func TestDockerRunArgsHardening(t *testing.T) {
	t.Parallel()
	args := dockerRunArgs("sbx-1", "golang:alpine", "/tmp/work", 128, "1.5", "go", "run", ".")
	joined := strings.Join(args, " ")

	required := []string{
		"--network none",
		"--memory 128m",
		"--cpus 1.5",
		"--pids-limit 64",
		"--cap-drop ALL",
		"--read-only",
		"--security-opt no-new-privileges",
		"--name sbx-1",
	}
	for _, want := range required {
		if !strings.Contains(joined, want) {
			t.Fatalf("docker args missing %q; got: %s", want, joined)
		}
	}
	if args[len(args)-3] != "go" || args[len(args)-1] != "." {
		t.Fatalf("command not appended correctly: %v", args)
	}
}
