package service

import (
	"testing"
	"time"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

func TestComputeStalePracticeModes_NeverPracticed(t *testing.T) {
	now := time.Date(2026, 6, 28, 12, 0, 0, 0, time.UTC)
	stale := computeStalePracticeModes(nil, now)
	if len(stale) != 4 {
		t.Fatalf("expected 4 stale modes for new user, got %d", len(stale))
	}
	if stale[0].SessionMode != "algorithms_training" {
		t.Fatalf("first mode = %q", stale[0].SessionMode)
	}
}

func TestComputeStalePracticeModes_RecentActivityExcluded(t *testing.T) {
	now := time.Date(2026, 6, 28, 12, 0, 0, 0, time.UTC)
	last := now.AddDate(0, 0, -3)
	stale := computeStalePracticeModes([]model.UserPracticeModeActivity{
		{SessionMode: "algorithms_training", LastPracticedAt: last},
	}, now)
	for _, m := range stale {
		if m.SessionMode == "algorithms_training" {
			t.Fatalf("recent algorithms mode should not be stale")
		}
	}
}

func TestSoloIDFromSessionMode(t *testing.T) {
	if got := soloIDFromSessionMode("algorithms_training"); got != "algo" {
		t.Fatalf("algo solo id = %q", got)
	}
	if got := soloIDFromSessionMode("behavioral_training"); got != "behavioral" {
		t.Fatalf("behavioral solo id = %q", got)
	}
}
