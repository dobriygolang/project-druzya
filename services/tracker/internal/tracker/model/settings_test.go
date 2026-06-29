package model

import "testing"

func TestIsEpicDeferredForSprint(t *testing.T) {
	deferred := []string{"Review", "Skills"}
	if !IsEpicDeferredForSprint("review", deferred) {
		t.Fatal("expected review deferred")
	}
	if IsEpicDeferredForSprint("Retries", deferred) {
		t.Fatal("expected Retries active")
	}
	if IsEpicDeferredForSprint("", deferred) {
		t.Fatal("empty epic name should not defer")
	}
}
