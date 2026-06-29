package plan

import "testing"

func TestResolvePlanClock_defaultsToTodayInTZ(t *testing.T) {
	clock := ResolvePlanClock("", "Europe/Moscow")
	if clock.LocalDate == "" {
		t.Fatal("expected local date")
	}
	if clock.Location.String() != "Europe/Moscow" {
		t.Fatalf("location = %s", clock.Location)
	}
	if clock.Now.Location().String() != "Europe/Moscow" {
		t.Fatalf("now location = %s", clock.Now.Location())
	}
}

func TestResolvePlanClock_honorsLocalDate(t *testing.T) {
	clock := ResolvePlanClock("2026-06-15", "UTC")
	if clock.LocalDate != "2026-06-15" {
		t.Fatalf("date = %s", clock.LocalDate)
	}
}

func TestResolvePlanClock_invalidDateFallsBack(t *testing.T) {
	clock := ResolvePlanClock("not-a-date", "UTC")
	if clock.LocalDate == "not-a-date" {
		t.Fatal("expected fallback date")
	}
}

func TestReconcileDebounceKey(t *testing.T) {
	if ReconcileDebounceKey("u1", "2026-06-15") != "u1|2026-06-15" {
		t.Fatal("unexpected key")
	}
}
