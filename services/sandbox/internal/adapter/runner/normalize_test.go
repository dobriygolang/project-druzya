package runner

import "testing"

func TestNormalizeOutput(t *testing.T) {
	t.Parallel()
	if NormalizeOutput("hello\n") != "hello" {
		t.Fatalf("expected trimmed output")
	}
	if NormalizeOutput("a\r\nb\r\n") != "a\nb" {
		t.Fatalf("expected normalized newlines")
	}
}

func TestOutputsMatch(t *testing.T) {
	t.Parallel()
	if !outputsMatch("42\n", "42") {
		t.Fatalf("trailing newline should match")
	}
	if outputsMatch("41", "42") {
		t.Fatalf("different values should not match")
	}
}
