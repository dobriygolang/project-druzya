package plan

import "testing"

func TestIsEpicDeferred(t *testing.T) {
	deferred := []string{"Review", "Skills"}
	if !IsEpicDeferred("review", deferred) {
		t.Fatal("expected review deferred")
	}
	if IsEpicDeferred("Retries", deferred) {
		t.Fatal("expected Retries active")
	}
}
