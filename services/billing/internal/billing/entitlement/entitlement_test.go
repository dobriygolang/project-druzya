package entitlement_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/sedorofeevd/project-druzya/services/billing/internal/billing/entitlement"
)

func TestParseBoolEntitlement(t *testing.T) {
	t.Parallel()
	val, err := entitlement.Parse(json.RawMessage(`{"type":"bool","value":true}`))
	if err != nil {
		t.Fatal(err)
	}
	if val.Type != entitlement.TypeBool || !val.Value {
		t.Fatalf("unexpected: %+v", val)
	}
}

func TestPeriodWindowDay(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, 6, 27, 15, 30, 0, 0, time.UTC)
	start, end, err := entitlement.PeriodWindow(entitlement.PeriodDay, now)
	if err != nil {
		t.Fatal(err)
	}
	if start.Day() != 27 || end.Sub(start) != 24*time.Hour {
		t.Fatalf("unexpected window: %s -> %s", start, end)
	}
}

func TestRemaining(t *testing.T) {
	t.Parallel()
	limit := 10
	left := entitlement.Remaining(&limit, 3)
	if left == nil || *left != 7 {
		t.Fatalf("expected 7 remaining, got %v", left)
	}
}
