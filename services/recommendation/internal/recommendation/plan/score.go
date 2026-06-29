package plan

import (
	"math"
	"sort"
	"strings"
	"time"
)

func ScoreTask(t TaskInput, skillScores map[string]int, now time.Time) ScoredTask {
	meta := t.Metadata
	if meta == nil {
		meta = map[string]any{}
	}
	kind := metaString(meta, "task_kind")
	briefType := metaString(meta, "brief_type")
	reason := reasonFromMeta(kind, briefType, meta, t.Source)

	w := weightForReason(reason)
	uRetry := urgencyRetry(meta, now)
	uStale := urgencyStale(meta)
	uWeak := urgencyWeak(meta, skillScores)
	score := w * (1 + 0.4*uRetry + 0.3*uStale + 0.3*uWeak)
	score += recPriorityBonus(metaString(meta, "rec_priority"))
	if t.Position >= 0 && t.Position <= 2 {
		score += 80
	}
	if pinned, ok := meta["pinned"].(bool); ok && pinned {
		score += 80
	}

	return ScoredTask{TaskInput: t, Score: score, ReasonCode: reason}
}

func SortScoredTasks(tasks []ScoredTask) {
	sort.SliceStable(tasks, func(i, j int) bool {
		if tasks[i].Score != tasks[j].Score {
			return tasks[i].Score > tasks[j].Score
		}
		if tasks[i].Position != tasks[j].Position {
			return tasks[i].Position < tasks[j].Position
		}
		return tasks[i].CreatedAt.Before(tasks[j].CreatedAt)
	})
}

func PartitionToday(scored []ScoredTask) TodayPartition {
	SortScoredTasks(scored)
	out := TodayPartition{BudgetCap: DailyBudgetCapacity}
	used := 0.0
	for _, t := range scored {
		est := t.EstimateDays
		if est <= 0 {
			est = EstimateDefault
		}
		if len(out.Today) == 0 && est > out.BudgetCap {
			out.Today = append(out.Today, t)
			out.BudgetUsed = est
			continue
		}
		if used+est <= out.BudgetCap {
			out.Today = append(out.Today, t)
			used += est
			out.BudgetUsed = used
		} else {
			out.Later = append(out.Later, t)
		}
	}
	return out
}

func reasonFromMeta(kind, briefType string, meta map[string]any, source string) string {
	if briefType != "" {
		return briefType
	}
	if metaString(meta, "retry_item_id") != "" {
		return "retry"
	}
	if metaString(meta, "article_slug") != "" {
		return "learning"
	}
	if metaString(meta, "session_mode") != "" || strings.HasPrefix(metaString(meta, "dedup_key"), "stale:") {
		return "review"
	}
	switch kind {
	case "system":
		if metaString(meta, "skill_key") != "" {
			return "skill"
		}
		if metaString(meta, "recommendation_id") != "" {
			return recReason(meta)
		}
		return "skill"
	case "general":
		return "user"
	}
	if source == "user" || source == "TASK_SOURCE_USER" {
		return "user"
	}
	if metaString(meta, "recommendation_id") != "" {
		return recReason(meta)
	}
	return "user"
}

func recReason(meta map[string]any) string {
	if t := metaString(meta, "rec_type"); t == "take_mock_interview" {
		return "mock"
	}
	return "skill"
}

func weightForReason(reason string) float64 {
	switch reason {
	case "retry":
		return 1000
	case "mock":
		return 850
	case "review":
		return 800
	case "skill":
		return 600
	case "learning":
		return 450
	case "recommendation":
		return 400
	case "user_learning":
		return 250
	default:
		return 150
	}
}

func recPriorityBonus(priority string) float64 {
	switch strings.ToLower(priority) {
	case "high":
		return 50
	case "medium":
		return 30
	case "low":
		return 10
	default:
		return 0
	}
}

func urgencyRetry(meta map[string]any, now time.Time) float64 {
	created := metaTime(meta, "retry_created_at")
	if created.IsZero() {
		return 0.5
	}
	days := now.Sub(created).Hours() / 24
	return math.Min(1, days/7)
}

func urgencyStale(meta map[string]any) float64 {
	days := metaFloat(meta, "days_since_practice")
	if days <= 0 {
		return 0.5
	}
	return math.Min(1, days/14)
}

func urgencyWeak(meta map[string]any, skillScores map[string]int) float64 {
	key := metaString(meta, "skill_key")
	if key == "" {
		return 0
	}
	score, ok := skillScores[key]
	if !ok || score >= 70 {
		return 0
	}
	return math.Max(0, float64(70-score)/70)
}

func metaString(meta map[string]any, key string) string {
	if meta == nil {
		return ""
	}
	v, ok := meta[key].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(v)
}

func metaFloat(meta map[string]any, key string) float64 {
	if meta == nil {
		return 0
	}
	switch v := meta[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	case int32:
		return float64(v)
	default:
		return 0
	}
}

func metaTime(meta map[string]any, key string) time.Time {
	if meta == nil {
		return time.Time{}
	}
	switch v := meta[key].(type) {
	case time.Time:
		return v
	case string:
		t, err := time.Parse(time.RFC3339, v)
		if err == nil {
			return t
		}
	}
	return time.Time{}
}
