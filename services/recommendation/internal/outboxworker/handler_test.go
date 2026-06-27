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
