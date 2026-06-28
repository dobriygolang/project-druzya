package runner

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPrepareGoWorkspace(t *testing.T) {
	t.Parallel()
	dir := t.TempDir()
	if err := prepareGoWorkspace(dir); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(dir, "go.mod"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != goModContents {
		t.Fatalf("unexpected go.mod:\n%s", data)
	}
}
