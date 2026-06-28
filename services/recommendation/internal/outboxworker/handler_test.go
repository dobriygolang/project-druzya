package outboxworker_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	interviewmocks "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview/mocks"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/outboxworker"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
	servicemocks "github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/service/mocks"
)

func TestHandleEvent_RoutesSessionCompleted(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	interview := interviewmocks.NewClient(t)
	svc := servicemocks.NewService(t)
	h := &outboxworker.Handler{Interview: interview, Service: svc}

	ev := interviewadapter.OutboxEvent{
		ID:        "evt-1",
		EventName: outboxworker.SessionCompletedEvent,
		Payload: map[string]any{
			"session_id": "session-1",
			"user_id":    "550e8400-e29b-41d4-a716-446655440000",
			"mode":       "algorithms_training",
		},
	}

	svc.EXPECT().HandleSessionCompleted(ctx, ev.ID, mock.MatchedBy(func(e model.SessionCompletedEvent) bool {
		return e.SessionID == "session-1" && e.Mode == "algorithms_training"
	})).Return(nil)
	interview.EXPECT().AckOutboxEvents(ctx, []string{ev.ID}).Return(nil)

	require.NoError(t, h.HandleEvent(ctx, ev))
}

func TestHandleEvent_RoutesTaskSkipped(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	interview := interviewmocks.NewClient(t)
	svc := servicemocks.NewService(t)
	h := &outboxworker.Handler{Interview: interview, Service: svc}

	ev := interviewadapter.OutboxEvent{
		ID:        "evt-skip",
		EventName: outboxworker.TaskSkippedEvent,
		Payload: map[string]any{
			"session_task_id": "st-1",
			"session_id":      "session-1",
			"user_id":         "550e8400-e29b-41d4-a716-446655440000",
			"task_id":         "660e8400-e29b-41d4-a716-446655440001",
			"mode":            "algorithms_training",
		},
	}

	svc.EXPECT().HandleTaskSkipped(ctx, ev.ID, mock.MatchedBy(func(e model.TaskSkippedEvent) bool {
		return e.SessionTaskID == "st-1" && e.Mode == "algorithms_training"
	})).Return(nil)
	interview.EXPECT().AckOutboxEvents(ctx, []string{ev.ID}).Return(nil)

	require.NoError(t, h.HandleEvent(ctx, ev))
}

func TestParseTaskSkippedEvent(t *testing.T) {
	t.Parallel()

	event, err := outboxworker.ParseTaskSkippedEvent(map[string]any{
		"session_task_id": "st-1",
		"session_id":      "session-1",
		"user_id":         "550e8400-e29b-41d4-a716-446655440000",
		"task_id":         "660e8400-e29b-41d4-a716-446655440001",
		"mode":            "behavioral_training",
	})
	require.NoError(t, err)
	require.Equal(t, "st-1", event.SessionTaskID)
	require.Equal(t, "behavioral_training", event.Mode)
}

func TestHandleEvent_RejectAttemptSubmitted(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	h := &outboxworker.Handler{
		Interview: interviewmocks.NewClient(t),
		Service:   servicemocks.NewService(t),
	}

	err := h.HandleEvent(ctx, interviewadapter.OutboxEvent{
		ID:        "evt-submitted",
		EventName: "interview.attempt_submitted",
		Payload: map[string]any{
			"attempt_id": "a1",
			"user_id":    "u1",
		},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "not owned by recommendation")
}

func TestParseAttemptEvaluatedEvent_ScoreString(t *testing.T) {
	t.Parallel()

	event, err := outboxworker.ParseAttemptEvaluatedEvent(map[string]any{
		"attempt_id": "a1",
		"user_id":    "u1",
		"score":      "72.5",
		"passed":     true,
	})
	require.NoError(t, err)
	require.Equal(t, 72.5, event.Score)
	require.True(t, event.Passed)
}
