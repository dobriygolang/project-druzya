package repository

import "testing"

func TestMergeTaskMetadata(t *testing.T) {
	base := map[string]any{"task_kind": "system", "skill_key": "algo.overall"}
	patch := map[string]any{"brief_type": "skill", "action_path": "/mock"}
	merged := mergeTaskMetadata(base, patch)
	if merged["task_kind"] != "system" {
		t.Fatalf("expected preserved task_kind")
	}
	if merged["brief_type"] != "skill" {
		t.Fatalf("expected patched brief_type")
	}
}
