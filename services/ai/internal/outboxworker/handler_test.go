package outboxworker_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview"
	interviewmocks "github.com/sedorofeevd/project-druzya/services/ai/internal/adapter/interview/mocks"
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	servicemocks "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service/mocks"
	"github.com/sedorofeevd/project-druzya/services/ai/internal/outboxworker"
)

func TestHandleEvent_successAcks(t *testing.T) {
	t.Parallel()

	interview := interviewmocks.NewClient(t)
	svc := servicemocks.NewService(t)

	h := &outboxworker.Handler{Interview: interview, Service: svc}
	ev := interviewadapter.OutboxEvent{
		ID: "ev-1",
		Payload: map[string]any{
			"attempt_id": "attempt-1",
			"user_id":    "user-1",
			"task_id":    "task-1",
		},
	}

	svc.EXPECT().
		HandleAttemptSubmitted(mock.Anything, evaluationmodel.AttemptSubmittedEvent{
			AttemptID: "attempt-1",
			UserID:    "user-1",
			TaskID:    "task-1",
		}).
		Return(nil).
		Once()

	interview.EXPECT().
		AckOutboxEvents(mock.Anything, []string{"ev-1"}).
		Return(nil).
		Once()

	require.NoError(t, h.HandleEvent(context.Background(), ev))
}

func TestHandleEvent_handlerErrorFails(t *testing.T) {
	t.Parallel()

	interview := interviewmocks.NewClient(t)
	svc := servicemocks.NewService(t)
	h := &outboxworker.Handler{Interview: interview, Service: svc}

	ev := interviewadapter.OutboxEvent{
		ID: "ev-2",
		Payload: map[string]any{
			"attempt_id": "attempt-1",
		},
	}

	handlerErr := errors.New("evaluation failed")
	svc.EXPECT().
		HandleAttemptSubmitted(mock.Anything, mock.Anything).
		Return(handlerErr).
		Once()

	interview.EXPECT().
		FailOutboxEvent(mock.Anything, "ev-2", handlerErr.Error()).
		Return(nil).
		Once()

	err := h.HandleEvent(context.Background(), ev)
	require.Error(t, err)
	require.ErrorContains(t, err, "handle attempt submitted")
}

func TestHandleEvent_invalidPayloadFails(t *testing.T) {
	t.Parallel()

	interview := interviewmocks.NewClient(t)
	h := &outboxworker.Handler{Interview: interview}

	ev := interviewadapter.OutboxEvent{
		ID:      "ev-3",
		Payload: map[string]any{"user_id": "user-1"},
	}

	interview.EXPECT().
		FailOutboxEvent(mock.Anything, "ev-3", mock.MatchedBy(func(msg string) bool {
			return msg != ""
		})).
		Return(nil).
		Once()

	err := h.HandleEvent(context.Background(), ev)
	require.Error(t, err)
	require.ErrorContains(t, err, "parse payload")
}

func TestParseAttemptSubmittedEvent(t *testing.T) {
	t.Parallel()

	event, err := outboxworker.ParseAttemptSubmittedEvent(map[string]any{
		"attempt_id": "a1",
		"user_id":    "u1",
	})
	require.NoError(t, err)
	require.Equal(t, "a1", event.AttemptID)

	_, err = outboxworker.ParseAttemptSubmittedEvent(map[string]any{})
	require.Error(t, err)
}
