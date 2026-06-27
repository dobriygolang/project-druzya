package caveman

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCompressText_preservesCodeBlock(t *testing.T) {
	in := "Task:\nfoo\n\n```go\nfunc main() {}\n```\n\nCandidate answer: bar"
	out, saved := CompressText(LevelLite, in)
	require.Contains(t, out, "```go\nfunc main() {}\n```")
	require.Contains(t, out, "Answer:")
	require.Greater(t, saved, 0)
}

func TestCompressText_minifiesJSON(t *testing.T) {
	in := "Rubric criteria (JSON):\n[\n  {\n    \"key\": \"edge_cases\",\n    \"score\": 40\n  }\n]\n"
	out, saved := CompressText(LevelLite, in)
	require.Contains(t, out, `"key":"edge_cases"`)
	require.NotContains(t, out, "\n  {")
	require.Greater(t, saved, 0)
}

func TestCompressText_fullRemovesFiller(t *testing.T) {
	in := "This is basically just a simple test in order to verify filler removal."
	out, _ := CompressText(LevelFull, in)
	require.NotContains(t, strings.ToLower(out), "basically")
	require.NotContains(t, strings.ToLower(out), "in order to")
}

func TestCompressText_offPassthrough(t *testing.T) {
	in := "hello world"
	out, saved := CompressText(LevelOff, in)
	require.Equal(t, in, out)
	require.Equal(t, 0, saved)
}
