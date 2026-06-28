package runner

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/sedorofeevd/project-druzya/services/sandbox/internal/sandbox/model"
)

const goModContents = "module sandbox\n\ngo 1.24\n"

func isGoLanguage(language string) bool {
	switch strings.ToLower(strings.TrimSpace(language)) {
	case model.LangGo, "golang":
		return true
	default:
		return false
	}
}

func prepareGoWorkspace(dir string) error {
	return PrepareGoWorkspace(dir)
}

// PrepareGoWorkspace writes sandbox go.mod for isolated Go workspaces (runs, LSP).
func PrepareGoWorkspace(dir string) error {
	return writeGoMod(dir)
}

func writeGoMod(dir string) error {
	return os.WriteFile(filepath.Join(dir, "go.mod"), []byte(goModContents), 0o600)
}
