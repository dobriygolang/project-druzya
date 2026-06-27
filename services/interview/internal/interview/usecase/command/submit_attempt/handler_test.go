package submit_attempt_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/submit_attempt"
	"github.com/sedorofeevd/project-druzya/services/interview/internal/interview/usecase/command/submit_attempt/mocks"
)

func ptr(s string) *string { return &s }

func TestCommandValidate(t *testing.T) {
	t.Parallel()
	cases := map[string]struct {
		cmd     submit_attempt.Command
		wantErr bool
	}{
		"missing ids":     {submit_attempt.Command{AnswerText: ptr("x")}, true},
		"missing payload": {submit_attempt.Command{UserID: "u", SessionTaskID: "st"}, true},
		"valid answer":    {submit_attempt.Command{UserID: "u", SessionTaskID: "st", AnswerText: ptr("a")}, false},
		"valid code":      {submit_attempt.Command{UserID: "u", SessionTaskID: "st", Code: ptr("c")}, false},
	}
	for name, tc := range cases {
		tc := tc
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			err := tc.cmd.Validate()
			if tc.wantErr {
				require.ErrorIs(t, err, interviewmodel.ErrInvalidInput)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestHandleSuccess(t *testing.T) {
	t.Parallel()
	repo := mocks.NewRepository(t)
	content := mocks.NewContentClient(t)
	h := submit_attempt.New(repo, content, time.Hour)

	repo.EXPECT().GetSessionTaskForUser(mock.Anything, "u1", "st1").
		Return(&interviewmodel.SessionTask{ID: "st1", SessionID: "s1", TaskID: "t1", Status: interviewmodel.SessionTaskAssigned}, nil)
	repo.EXPECT().GetSessionForUser(mock.Anything, "u1", "s1").
		Return(&interviewmodel.Session{ID: "s1", UserID: "u1", Status: interviewmodel.SessionStatusActive, StartedAt: time.Now().UTC()}, nil)
	content.EXPECT().GetTask(mock.Anything, "t1").Return(&contentadapter.Task{ID: "t1"}, nil)
	repo.EXPECT().WithTx(mock.Anything, mock.AnythingOfType("func(context.Context) error")).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error { return fn(ctx) })
	repo.EXPECT().CreateAttempt(mock.Anything, mock.AnythingOfType("*model.Attempt")).Return(nil)
	repo.EXPECT().UpdateSessionTask(mock.Anything, mock.MatchedBy(func(t *interviewmodel.SessionTask) bool {
		return t.Status == interviewmodel.SessionTaskSubmitted
	})).Return(nil)
	repo.EXPECT().InsertOutbox(mock.Anything, "interview.attempt_submitted", mock.Anything).Return(nil)

	attempt, err := h.Handle(context.Background(), submit_attempt.Command{
		UserID: "u1", SessionTaskID: "st1", AnswerText: ptr("my answer"),
	})
	require.NoError(t, err)
	require.Equal(t, interviewmodel.AttemptStatusEvaluating, attempt.Status)
	require.Equal(t, "t1", attempt.TaskID)
}

func TestHandleAlreadySubmittedConflict(t *testing.T) {
	t.Parallel()
	repo := mocks.NewRepository(t)
	content := mocks.NewContentClient(t)
	h := submit_attempt.New(repo, content, time.Hour)

	repo.EXPECT().GetSessionTaskForUser(mock.Anything, "u1", "st1").
		Return(&interviewmodel.SessionTask{ID: "st1", SessionID: "s1", TaskID: "t1", Status: interviewmodel.SessionTaskSubmitted}, nil)
	repo.EXPECT().GetSessionForUser(mock.Anything, "u1", "s1").
		Return(&interviewmodel.Session{ID: "s1", UserID: "u1", Status: interviewmodel.SessionStatusActive, StartedAt: time.Now().UTC()}, nil)

	_, err := h.Handle(context.Background(), submit_attempt.Command{
		UserID: "u1", SessionTaskID: "st1", AnswerText: ptr("a"),
	})
	require.Error(t, err)
}
