package plan

import (
	"testing"
	"time"
)

func TestPartitionToday_respectsBudget(t *testing.T) {
	now := time.Now().UTC()
	scored := []ScoredTask{
		{TaskInput: TaskInput{ID: "a", EstimateDays: 0.5, CreatedAt: now}, Score: 1000, ReasonCode: "retry"},
		{TaskInput: TaskInput{ID: "b", EstimateDays: 1.0, CreatedAt: now}, Score: 800, ReasonCode: "review"},
		{TaskInput: TaskInput{ID: "c", EstimateDays: 1.0, CreatedAt: now}, Score: 600, ReasonCode: "skill"},
	}
	part := PartitionToday(scored)
	if len(part.Today) != 2 {
		t.Fatalf("today len = %d, want 2", len(part.Today))
	}
	if len(part.Later) != 1 {
		t.Fatalf("later len = %d, want 1", len(part.Later))
	}
	if part.BudgetUsed != 1.5 {
		t.Fatalf("budget used = %v, want 1.5", part.BudgetUsed)
	}
}

func TestScoreTask_retryHighest(t *testing.T) {
	now := time.Now().UTC()
	retry := ScoreTask(TaskInput{
		ID: "r", EstimateDays: 0.5, CreatedAt: now,
		Metadata: map[string]any{"retry_item_id": "x", "brief_type": "retry"},
	}, nil, now)
	user := ScoreTask(TaskInput{
		ID: "u", EstimateDays: 1, Source: "user", CreatedAt: now,
		Metadata: map[string]any{"task_kind": "general"},
	}, nil, now)
	if retry.Score <= user.Score {
		t.Fatalf("retry score %v should beat user %v", retry.Score, user.Score)
	}
}

func TestPartitionToday_largeSingleTask(t *testing.T) {
	now := time.Now().UTC()
	part := PartitionToday([]ScoredTask{
		{TaskInput: TaskInput{ID: "big", EstimateDays: 2.0, CreatedAt: now}, Score: 900, ReasonCode: "mock"},
	})
	if len(part.Today) != 1 {
		t.Fatalf("expected one today task for oversized item")
	}
}
