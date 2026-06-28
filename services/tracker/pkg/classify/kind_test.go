package classify

import "testing"

func TestTitle_Event(t *testing.T) {
	r := Title("Созвон с командой в 15:30")
	if r.Kind != KindEvent {
		t.Fatalf("got %q want event", r.Kind)
	}
	if r.Meta["event_time"] != "15:30" {
		t.Fatalf("time: %v", r.Meta["event_time"])
	}
}

func TestTitle_EventBareTime(t *testing.T) {
	r := Title("Позвонить маме в 15:00")
	if r.Kind != KindEvent {
		t.Fatalf("got %q want event", r.Kind)
	}
	if r.Meta["event_time"] != "15:00" {
		t.Fatalf("time: %v", r.Meta["event_time"])
	}
}

func TestTitle_LearningDDIA(t *testing.T) {
	r := Title("DDIA глава 5 Replication")
	if r.Kind != KindLearning {
		t.Fatalf("got %q want learning", r.Kind)
	}
	if r.Meta["book"] != "DDIA" {
		t.Fatalf("book: %v", r.Meta["book"])
	}
}

func TestTitle_General(t *testing.T) {
	r := Title("fix bug in auth")
	if r.Kind != KindGeneral {
		t.Fatalf("got %q want general", r.Kind)
	}
}

func TestInferSkillKey(t *testing.T) {
	if got := InferSkillKey(map[string]any{"book": "DDIA"}); got != "distributed_systems" {
		t.Fatalf("book hint: got %q", got)
	}
	if got := InferSkillKey(map[string]any{"topic": "replication basics"}); got != "replication" {
		t.Fatalf("topic hint: got %q", got)
	}
}

func TestShouldEnrich(t *testing.T) {
	if !ShouldEnrich(KindLearning) {
		t.Fatal("learning should enrich")
	}
	if ShouldEnrich(KindEvent) {
		t.Fatal("event should not enrich")
	}
}
