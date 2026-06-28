package classify

import (
	"regexp"
	"strconv"
	"strings"
)

// Task kinds — stored in task metadata as task_kind.
const (
	KindLearning = "learning"
	KindEvent    = "event"
	KindLife     = "life"
	KindGeneral  = "general"
	KindSystem   = "system" // recommendation / enrichment sources
)

var (
	timePattern = regexp.MustCompile(`(?i)(?:\bв\s+|\bat\s+|\b@?\s*)(\d{1,2}[:.]\d{2})\b`)
	datePattern = regexp.MustCompile(`(?i)\b(\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)\b`)
)

var eventKeywords = []string{
	"созвон", "встреча", "звонок", "call", "meeting", "sync", "standup", "stand-up",
	"interview", "demo", "retro", "1:1", "one-on-one", "zoom", "teams", "google meet",
}

var learningKeywords = []string{
	"ddia", "designing data-intensive", "прочитать", "read ", "read:", "глава", "chapter",
	"статья", "article", "learn", "mock", "practice", "потренировать", "повторить",
	"retry", "leetcode", "system design", "алгоритм",
}

var lifeKeywords = []string{
	"купить", "оплатить", "банк", "врач", "dentist", "doctor", "спорт", "gym",
	"уборка", "почта",
}

// Result is rule-based classification from free-text title.
type Result struct {
	Kind     string
	Signals  []string
	Meta     map[string]any
	EpicHint *string
}

// Title classifies a user-entered task title without LLM.
func Title(title string) Result {
	lower := strings.ToLower(strings.TrimSpace(title))
	res := Result{Kind: KindGeneral, Meta: map[string]any{}}

	if k, epic := detectLearning(lower, title); k != "" {
		res.Kind = KindLearning
		res.Signals = append(res.Signals, "learning_keyword")
		res.Meta = learningMeta(lower, title)
		res.EpicHint = epic
		return res
	}

	if detectEvent(lower) {
		res.Kind = KindEvent
		res.Signals = append(res.Signals, "event_keyword")
		if t := timePattern.FindStringSubmatch(title); len(t) == 2 {
			res.Meta["event_time"] = strings.ReplaceAll(t[1], ".", ":")
			res.Signals = append(res.Signals, "time")
		}
		if d := datePattern.FindString(title); d != "" {
			res.Meta["event_date"] = d
		}
		hint := "Events"
		res.EpicHint = &hint
		return res
	}

	if detectLife(lower) {
		res.Kind = KindLife
		res.Signals = append(res.Signals, "life_keyword")
		hint := "Life"
		res.EpicHint = &hint
		return res
	}

	return res
}

func detectEvent(lower string) bool {
	for _, kw := range eventKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return timePattern.MatchString(lower)
}

func detectLife(lower string) bool {
	for _, kw := range lifeKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

func detectLearning(lower, raw string) (string, *string) {
	for _, kw := range learningKeywords {
		if strings.Contains(lower, kw) {
			return KindLearning, learningEpicHint(lower, raw)
		}
	}
	return "", nil
}

func learningEpicHint(lower, raw string) *string {
	if strings.Contains(lower, "ddia") || strings.Contains(lower, "designing data") {
		h := "DDIA"
		return &h
	}
	return nil
}

func learningMeta(lower, raw string) map[string]any {
	meta := map[string]any{}
	if strings.Contains(lower, "ddia") || strings.Contains(lower, "designing data") {
		meta["book"] = "DDIA"
		meta["skill_key"] = "distributed_systems"
		chapterPattern := regexp.MustCompile(`(?i)(?:глава|chapter)\s*(\d+)`)
		if m := chapterPattern.FindStringSubmatch(raw); len(m) == 2 {
			if ch, err := strconv.Atoi(m[1]); err == nil {
				meta["chapter"] = ch
			}
		}
	}
	if strings.Contains(lower, "replication") {
		meta["skill_key"] = "replication"
	}
	return meta
}

// ShouldEnrich returns true only for learning tasks recommendation may extend.
func ShouldEnrich(kind string) bool {
	return kind == KindLearning
}

// InferSkillKey returns skill_key from metadata or infers from book/topic hints.
func InferSkillKey(meta map[string]any) string {
	if meta == nil {
		return ""
	}
	if sk, ok := meta["skill_key"].(string); ok && sk != "" {
		return sk
	}
	if book, ok := meta["book"].(string); ok {
		switch strings.ToUpper(strings.TrimSpace(book)) {
		case "DDIA":
			return "distributed_systems"
		}
	}
	if topic, ok := meta["topic"].(string); ok {
		lower := strings.ToLower(strings.TrimSpace(topic))
		if strings.Contains(lower, "replication") {
			return "replication"
		}
		if strings.Contains(lower, "algorithm") || strings.Contains(lower, "array") {
			return "algorithm.arrays"
		}
	}
	return ""
}
