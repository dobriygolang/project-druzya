package runner

import (
	"os"
	"path/filepath"
)

const goModContents = "module sandbox\n\ngo 1.24\n"

func prepareGoWorkspace(dir string) error {
	return os.WriteFile(filepath.Join(dir, "go.mod"), []byte(goModContents), 0o600)
}
