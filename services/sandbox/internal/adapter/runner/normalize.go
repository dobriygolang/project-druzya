package runner

import "strings"

// NormalizeOutput trims trailing whitespace and normalizes line endings for comparison.
func NormalizeOutput(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	return strings.TrimRight(s, " \t\n\r")
}

func outputsMatch(actual, expected string) bool {
	return NormalizeOutput(actual) == NormalizeOutput(expected)
}

func truncateOutput(s string, maxBytes int) string {
	if maxBytes <= 0 || len(s) <= maxBytes {
		return s
	}
	return s[:maxBytes] + "\n...[truncated]"
}
