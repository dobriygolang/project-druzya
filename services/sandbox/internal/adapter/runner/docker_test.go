package runner

import (
	"strings"
	"testing"
)

func TestDockerRunArgsHardening(t *testing.T) {
	t.Parallel()
	args := dockerRunArgs("sbx-1", "golang:alpine", "/tmp/work", "/var/lib/sandbox-work/gocache", 128, "1.5", "go", "run", "main.go")
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
		"GOCACHE=/var/lib/sandbox-work/gocache",
		"/var/lib/sandbox-work/gocache:/var/lib/sandbox-work/gocache:rw",
	}
	for _, want := range required {
		if !strings.Contains(joined, want) {
			t.Fatalf("docker args missing %q; got: %s", want, joined)
		}
	}
	if args[len(args)-3] != "go" || args[len(args)-1] != "main.go" {
		t.Fatalf("command not appended correctly: %v", args)
	}
}
