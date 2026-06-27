package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	contentmocks "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content/mocks"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	eventsmocks "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events/mocks"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	servicemocks "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service/mocks"
)

type fixture struct {
	repo    *servicemocks.Repository
	content *contentmocks.Client
	events  *eventsmocks.Publisher
	svc     interviewservice.Service
}

func setUp(t *testing.T) *fixture {
	t.Helper()

	fx := &fixture{
		repo:    servicemocks.NewRepository(t),
		content: contentmocks.NewClient(t),
		events:  eventsmocks.NewPublisher(t),
	}
	fx.svc = interviewservice.New(interviewservice.Deps{
		Repo:          fx.repo,
		Content:       fx.content,
		Events:        fx.events,
		SessionTTL:    time.Hour,
		TrainingLimit: 10,
	})
	return fx
}

func TestStartInterviewSession(t *testing.T) {
	t.Parallel()

	const (
		passingScore = 90
		userID       = "user-1"
	)
	templateID := "tmpl-1"

	fx := setUp(t)

	fx.content.EXPECT().
		GetInterviewTemplateDetail(mock.Anything, templateID).
		Return(&contentadapter.TemplateDetail{
			TemplateID:   templateID,
			PassingScore: passingScore,
			Sections: []contentadapter.TemplateSection{
				{
					SectionType: "algorithms",
					Title:       "Algorithms",
					Position:    1,
					TaskIDs:     []string{"task-1", "task-2"},
				},
				{
					SectionType: "system_design",
					Title:       "System Design",
					Position:    2,
					TaskIDs:     []string{"task-3"},
				},
			},
		}, nil).
		Once()

	fx.repo.EXPECT().
		CreateSessionBundle(mock.Anything, mock.Anything).
		Run(func(_ context.Context, bundle interviewrepo.SessionBundle) {
			require.Equal(t, userID, bundle.Session.UserID)
			require.Equal(t, passingScore, bundle.Session.PassingScore)
			require.Len(t, bundle.Sections, 2)
			require.Len(t, bundle.Tasks, 3)
			require.Equal(t, interviewmodel.SectionStatusActive, bundle.Sections[0].Status)
			require.Equal(t, interviewmodel.SectionStatusPending, bundle.Sections[1].Status)
		}).
		Return(nil).
		Once()

	fx.events.EXPECT().
		Publish(mock.Anything, mock.MatchedBy(func(ev eventsadapter.Event) bool {
			return ev.Name == eventsadapter.SessionStarted && ev.Payload["user_id"] == userID
		})).
		Return(nil).
		Once()

	detail, err := fx.svc.StartInterviewSession(
		context.Background(),
		userID,
		&templateID,
		interviewmodel.ModeCompanyInterview,
	)
	require.NoError(t, err)
	require.NotNil(t, detail)
	require.Equal(t, 2, detail.Progress.TotalSections)
	require.Equal(t, 3, detail.Progress.TotalTasks)
}

func TestSubmitAttempt_wrongUser(t *testing.T) {
	t.Parallel()

	const (
		ownerID       = "user-owner"
		otherUserID   = "user-other"
		sessionTaskID = "st-1"
	)

	fx := setUp(t)

	fx.repo.EXPECT().
		GetSessionTaskForUser(mock.Anything, otherUserID, sessionTaskID).
		Return(nil, interviewrepo.ErrNotFound).
		Once()

	answer := "answer"
	_, err := fx.svc.SubmitAttempt(context.Background(), interviewservice.SubmitAttemptInput{
		UserID:        otherUserID,
		SessionTaskID: sessionTaskID,
		AnswerText:    &answer,
	})
	require.ErrorIs(t, err, interviewservice.ErrNotFound)
}

func TestSubmitAttempt_alreadySubmitted(t *testing.T) {
	t.Parallel()

	const (
		userID        = "user-1"
		sessionTaskID = "st-1"
	)

	fx := setUp(t)

	fx.repo.EXPECT().
		GetSessionTaskForUser(mock.Anything, userID, sessionTaskID).
		Return(&interviewmodel.SessionTask{
			ID:        sessionTaskID,
			SessionID: "session-1",
			TaskID:    "task-1",
			Status:    interviewmodel.SessionTaskSubmitted,
		}, nil).
		Once()

	fx.repo.EXPECT().
		GetSessionForUser(mock.Anything, userID, "session-1").
		Return(&interviewmodel.Session{
			ID:        "session-1",
			UserID:    userID,
			Status:    interviewmodel.SessionStatusActive,
			StartedAt: time.Now().UTC(),
		}, nil).
		Once()

	answer := "answer"
	_, err := fx.svc.SubmitAttempt(context.Background(), interviewservice.SubmitAttemptInput{
		UserID:        userID,
		SessionTaskID: sessionTaskID,
		AnswerText:    &answer,
	})
	require.ErrorIs(t, err, interviewservice.ErrConflict)
}

func TestSubmitAttempt_writesOutboxInTransaction(t *testing.T) {
	t.Parallel()

	const (
		userID        = "user-1"
		sessionTaskID = "st-1"
		taskID        = "task-1"
	)

	fx := setUp(t)

	fx.repo.EXPECT().
		GetSessionTaskForUser(mock.Anything, userID, sessionTaskID).
		Return(&interviewmodel.SessionTask{
			ID:        sessionTaskID,
			SessionID: "session-1",
			TaskID:    taskID,
			Status:    interviewmodel.SessionTaskAssigned,
		}, nil).
		Once()

	fx.repo.EXPECT().
		GetSessionForUser(mock.Anything, userID, "session-1").
		Return(&interviewmodel.Session{
			ID:        "session-1",
			UserID:    userID,
			Status:    interviewmodel.SessionStatusActive,
			StartedAt: time.Now().UTC(),
		}, nil).
		Once()

	fx.content.EXPECT().
		GetTask(mock.Anything, taskID).
		Return(&contentadapter.Task{ID: taskID, Status: "published"}, nil).
		Once()

	fx.repo.EXPECT().
		WithTx(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		}).
		Once()

	fx.repo.EXPECT().
		CreateAttempt(mock.Anything, mock.Anything).
		Return(nil).
		Once()

	fx.repo.EXPECT().
		UpdateSessionTask(mock.Anything, mock.MatchedBy(func(st *interviewmodel.SessionTask) bool {
			return st.ID == sessionTaskID && st.Status == interviewmodel.SessionTaskSubmitted
		})).
		Return(nil).
		Once()

	fx.repo.EXPECT().
		InsertOutbox(mock.Anything, string(eventsadapter.AttemptSubmitted), mock.MatchedBy(func(payload map[string]any) bool {
			return payload["task_id"] == taskID && payload["user_id"] == userID
		})).
		Return(nil).
		Once()

	answer := "answer"
	attempt, err := fx.svc.SubmitAttempt(context.Background(), interviewservice.SubmitAttemptInput{
		UserID:        userID,
		SessionTaskID: sessionTaskID,
		AnswerText:    &answer,
	})
	require.NoError(t, err)
	require.Equal(t, interviewmodel.AttemptStatusEvaluating, attempt.Status)
}

func TestCompleteEvaluation_idempotent(t *testing.T) {
	t.Parallel()

	const attemptID = "attempt-1"
	existing := &interviewmodel.EvaluationSummary{
		ID:        "summary-1",
		AttemptID: attemptID,
		Passed:    true,
	}

	fx := setUp(t)

	fx.repo.EXPECT().
		WithTx(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		}).
		Once()

	fx.repo.EXPECT().
		GetAttemptByID(mock.Anything, attemptID).
		Return(&interviewmodel.Attempt{
			ID:     attemptID,
			Status: interviewmodel.AttemptStatusEvaluated,
		}, nil).
		Once()

	fx.repo.EXPECT().
		GetEvaluationSummaryByAttemptID(mock.Anything, attemptID).
		Return(existing, nil).
		Once()

	summary, err := fx.svc.CompleteEvaluation(context.Background(), interviewservice.CompleteEvaluationInput{
		AttemptID: attemptID,
		Score:     95,
	})
	require.NoError(t, err)
	require.Equal(t, existing, summary)
}

func TestCompleteEvaluation_notEvaluating(t *testing.T) {
	t.Parallel()

	const attemptID = "attempt-1"

	fx := setUp(t)

	fx.repo.EXPECT().
		WithTx(mock.Anything, mock.Anything).
		RunAndReturn(func(ctx context.Context, fn func(context.Context) error) error {
			return fn(ctx)
		}).
		Once()

	fx.repo.EXPECT().
		GetAttemptByID(mock.Anything, attemptID).
		Return(&interviewmodel.Attempt{
			ID:     attemptID,
			Status: interviewmodel.AttemptStatusSubmitted,
		}, nil).
		Once()

	_, err := fx.svc.CompleteEvaluation(context.Background(), interviewservice.CompleteEvaluationInput{
		AttemptID: attemptID,
		Score:     95,
	})
	require.ErrorIs(t, err, interviewservice.ErrConflict)
}

func TestSubmitAttempt_contentNotFound(t *testing.T) {
	t.Parallel()

	const (
		userID        = "user-1"
		sessionTaskID = "st-1"
		taskID        = "task-missing"
	)

	fx := setUp(t)

	fx.repo.EXPECT().
		GetSessionTaskForUser(mock.Anything, userID, sessionTaskID).
		Return(&interviewmodel.SessionTask{
			ID:        sessionTaskID,
			SessionID: "session-1",
			TaskID:    taskID,
			Status:    interviewmodel.SessionTaskAssigned,
		}, nil).
		Once()

	fx.repo.EXPECT().
		GetSessionForUser(mock.Anything, userID, "session-1").
		Return(&interviewmodel.Session{
			ID:        "session-1",
			UserID:    userID,
			Status:    interviewmodel.SessionStatusActive,
			StartedAt: time.Now().UTC(),
		}, nil).
		Once()

	fx.content.EXPECT().
		GetTask(mock.Anything, taskID).
		Return(nil, contentadapter.ErrNotFound).
		Once()

	answer := "answer"
	_, err := fx.svc.SubmitAttempt(context.Background(), interviewservice.SubmitAttemptInput{
		UserID:        userID,
		SessionTaskID: sessionTaskID,
		AnswerText:    &answer,
	})
	require.ErrorIs(t, err, interviewservice.ErrNotFound)
}

func TestStartInterviewSession_templateNotFound(t *testing.T) {
	t.Parallel()

	templateID := "missing"
	fx := setUp(t)

	fx.content.EXPECT().
		GetInterviewTemplateDetail(mock.Anything, templateID).
		Return(nil, contentadapter.ErrNotFound).
		Once()

	_, err := fx.svc.StartInterviewSession(
		context.Background(),
		"user-1",
		&templateID,
		interviewmodel.ModeCompanyInterview,
	)
	require.ErrorIs(t, err, interviewservice.ErrNotFound)
}
