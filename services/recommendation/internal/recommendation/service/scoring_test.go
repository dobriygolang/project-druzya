package service

import (
	"testing"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

func TestNormalizeScore(t *testing.T) {
	t.Parallel()
	cases := []struct {
		score, max float64
		want       int
	}{
		{30, 100, 30},
		{45, 90, 50},
		{0, 0, 0},
		{100, 100, 100},
	}
	for _, c := range cases {
		if got := normalizeScore(c.score, c.max); got != c.want {
			t.Fatalf("normalizeScore(%v,%v)=%d want %d", c.score, c.max, got, c.want)
		}
	}
}

func TestPriorityForScore(t *testing.T) {
	t.Parallel()
	if priorityForScore(40) != model.PriorityHigh {
		t.Fatal("score<50 should be high")
	}
	if priorityForScore(60) != model.PriorityMedium {
		t.Fatal("50<=score<70 should be medium")
	}
	if priorityForScore(80) != model.PriorityLow {
		t.Fatal("score>=70 should be low")
	}
}

func TestCalculateReadinessConfidenceWeighted(t *testing.T) {
	t.Parallel()
	// 90@conf30 and 50@conf10 -> (90*30+50*10)/(40) = 80
	got := calculateReadiness([]model.SkillScore{
		{Score: 90, Confidence: 30},
		{Score: 50, Confidence: 10},
		{Score: 100, Confidence: 0}, // ignored (no confidence)
	})
	if got != 80 {
		t.Fatalf("readiness=%d want 80", got)
	}
	if calculateReadiness(nil) != 0 {
		t.Fatal("empty scores should be 0 readiness")
	}
}

func TestParseCriteriaFromFeedback(t *testing.T) {
	t.Parallel()
	feedback := map[string]any{
		"criteria": []any{
			map[string]any{"key": "correctness", "score": 30.0, "max_score": 100.0, "task_type": "algorithm"},
		},
	}
	out := parseCriteria(feedback, "algorithm", 0)
	if len(out) != 1 || out[0].SkillKey != "algorithm.correctness" || out[0].Normalized != 30 {
		t.Fatalf("unexpected criteria: %+v", out)
	}
}

func TestParseCriteriaFallsBackToOverall(t *testing.T) {
	t.Parallel()
	out := parseCriteria(map[string]any{}, "behavioral", 72)
	if len(out) != 1 || out[0].Key != "overall" || out[0].SkillKey != "behavioral.overall" || out[0].Normalized != 72 {
		t.Fatalf("expected overall fallback, got %+v", out)
	}
}

func TestComputeStrengthsAndWeaknesses(t *testing.T) {
	t.Parallel()
	scores := []model.SkillScore{
		{SkillKey: "a", Score: 90, Confidence: 30}, // strength
		{SkillKey: "b", Score: 40, Confidence: 30}, // weakness
		{SkillKey: "c", Score: 95, Confidence: 10}, // low confidence -> neither
	}
	if s := computeStrengths(scores); len(s) != 1 || s[0].SkillKey != "a" {
		t.Fatalf("strengths=%+v", s)
	}
	if w := computeWeaknesses(scores); len(w) != 1 || w[0].SkillKey != "b" {
		t.Fatalf("weaknesses=%+v", w)
	}
}

func TestWeakestSkill(t *testing.T) {
	t.Parallel()
	scores := []model.SkillScore{
		{SkillKey: "a", Score: 65, Confidence: 30},
		{SkillKey: "b", Score: 40, Confidence: 30},
		{SkillKey: "c", Score: 30, Confidence: 10}, // low confidence -> ignored
	}
	w := weakestSkill(scores)
	if w == nil || w.SkillKey != "b" {
		t.Fatalf("weakest=%+v", w)
	}
	if weakestSkill([]model.SkillScore{{Score: 90, Confidence: 30}}) != nil {
		t.Fatal("no weak skill should return nil")
	}
}

func TestSectionLabelFromMode(t *testing.T) {
	t.Parallel()
	if sectionLabelFromMode("system_design_training") != "System design" {
		t.Fatal("system_design label")
	}
	if sectionLabelFromMode("unknown_mode_training") == "" {
		t.Fatal("fallback should not be empty")
	}
}
