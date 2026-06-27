package caveman

import (
	"bytes"
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

// Level controls how aggressively prompts are compressed before external LLM calls.
type Level string

const (
	LevelOff  Level = "off"
	LevelLite Level = "lite"
	LevelFull Level = "full"
)

// ParseLevel normalizes env/config values.
func ParseLevel(raw string) Level {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", "lite":
		return LevelLite
	case "full":
		return LevelFull
	case "off", "false", "0":
		return LevelOff
	default:
		return LevelLite
	}
}

var (
	fencedCodeRE = regexp.MustCompile("(?s)```.*?```")
	spaceRE      = regexp.MustCompile(`[ \t]+`)
	blankLinesRE = regexp.MustCompile(`\n{3,}`)
	fillerRE     = regexp.MustCompile(`(?i)\b(basically|actually|simply|really|just|essentially|generally|please note that|it is important to|in order to)\b`)

	labelReplacements = []struct{ old, new string }{
		{"Reference solutions (JSON, context only):", "Ref solutions:"},
		{"Rubric criteria (JSON):", "Rubric:"},
		{"Candidate answer:", "Answer:"},
		{"Task type:", "Type:"},
		{"Description:", "Desc:"},
		{"Задача:", "Task:"},
		{"Ответ кандидата:", "Answer:"},
	}
)

var errInvalidJSON = errors.New("invalid json")

// CompressText shrinks prose while preserving fenced code blocks and JSON structure.
func CompressText(level Level, text string) (string, int) {
	if level == LevelOff || text == "" {
		return text, 0
	}

	blocks := extractPreservedBlocks(text)
	placeholder := "\x00CB\x00"
	work := text
	for i, block := range blocks {
		work = strings.Replace(work, block, placeholder+string(rune('A'+i))+placeholder, 1)
	}

	work = shortenLabels(work)
	work = minifyEmbeddedJSON(work)
	work = spaceRE.ReplaceAllString(work, " ")
	work = blankLinesRE.ReplaceAllString(work, "\n\n")
	work = strings.TrimSpace(work)

	if level == LevelFull {
		work = fillerRE.ReplaceAllString(work, "")
		work = spaceRE.ReplaceAllString(work, " ")
	}

	for i, block := range blocks {
		work = strings.Replace(work, placeholder+string(rune('A'+i))+placeholder, block, 1)
	}

	saved := len(text) - len(work)
	if saved < 0 {
		saved = 0
	}
	return work, saved
}

func extractPreservedBlocks(text string) []string {
	return fencedCodeRE.FindAllString(text, -1)
}

func shortenLabels(s string) string {
	for _, pair := range labelReplacements {
		s = strings.ReplaceAll(s, pair.old, pair.new)
	}
	return s
}

func minifyEmbeddedJSON(s string) string {
	var buf strings.Builder
	i := 0
	for i < len(s) {
		switch s[i] {
		case '{', '[':
			end, ok := jsonSpan(s, i)
			if !ok {
				buf.WriteByte(s[i])
				i++
				continue
			}
			compact, err := compactJSON(s[i:end])
			if err != nil {
				buf.WriteString(s[i:end])
			} else {
				buf.WriteString(compact)
			}
			i = end
		default:
			buf.WriteByte(s[i])
			i++
		}
	}
	return buf.String()
}

func jsonSpan(s string, start int) (int, bool) {
	open := s[start]
	var close byte
	switch open {
	case '{':
		close = '}'
	case '[':
		close = ']'
	default:
		return 0, false
	}
	depth := 0
	inString := false
	escape := false
	for i := start; i < len(s); i++ {
		c := s[i]
		if inString {
			if escape {
				escape = false
				continue
			}
			if c == '\\' {
				escape = true
				continue
			}
			if c == '"' {
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			inString = true
		case open:
			depth++
		case close:
			depth--
			if depth == 0 {
				return i + 1, true
			}
		}
	}
	return 0, false
}

func compactJSON(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return raw, nil
	}
	if !json.Valid([]byte(raw)) {
		return raw, errInvalidJSON
	}
	var v any
	dec := json.NewDecoder(strings.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&v); err != nil {
		return raw, err
	}
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return raw, err
	}
	return strings.TrimSpace(buf.String()), nil
}

// Stats holds compression metrics for logging.
type Stats struct {
	Level       Level
	CharsBefore int
	CharsAfter  int
}

func (s Stats) Saved() int {
	if s.CharsBefore <= s.CharsAfter {
		return 0
	}
	return s.CharsBefore - s.CharsAfter
}

func (s Stats) SavedPct() float64 {
	if s.CharsBefore == 0 {
		return 0
	}
	return float64(s.Saved()) / float64(s.CharsBefore) * 100
}
