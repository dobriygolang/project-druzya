package service

import (
	"context"
	"time"

	googleadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/google"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
)

type Repository interface {
	ListWorkTasksByUser(ctx context.Context, userID string) ([]model.WorkTask, error)
	GetWorkTask(ctx context.Context, taskID, userID string) (*model.WorkTask, error)
	CreateWorkTask(ctx context.Context, userID, kind, title, status string) (*model.WorkTask, error)
	PatchWorkTask(ctx context.Context, taskID, userID string, patch repository.WorkTaskPatch) (*model.WorkTask, error)
	GetUserSettings(ctx context.Context, userID string) (*model.UserSettings, error)
	UpsertUserSettings(ctx context.Context, userID string, googleSync *bool) (*model.UserSettings, error)
	SaveGoogleOAuthState(ctx context.Context, userID, state string) error
	ConsumeGoogleOAuthState(ctx context.Context, state string) (string, error)
	SaveGoogleRefreshToken(ctx context.Context, userID, refreshToken string) error
	ClearGoogleRefreshToken(ctx context.Context, userID string) error
}

type Service interface {
	ListWorkTasks(ctx context.Context, userID string) ([]WorkTask, error)
	CreateWorkTask(ctx context.Context, userID string, in CreateWorkTaskParams) (*WorkTask, error)
	UpdateWorkTaskStatus(ctx context.Context, userID, taskID, status string) (*WorkTask, error)
	DeleteWorkTask(ctx context.Context, userID, taskID string) error
	ScheduleWorkTask(ctx context.Context, userID, taskID, startISO string, durationMin int) (*WorkTask, error)
	UnscheduleWorkTask(ctx context.Context, userID, taskID string) (*WorkTask, error)
	GetSettings(ctx context.Context, userID string) (*model.UserSettingsView, error)
	UpdateSettings(ctx context.Context, userID string, in UpdateSettingsParams) (*model.UserSettingsView, error)
	GetGoogleCalendarAuthURL(ctx context.Context, userID string) (string, error)
	HandleGoogleCallback(ctx context.Context, code, state string) (string, error)
	DisconnectGoogleCalendar(ctx context.Context, userID string) (*model.UserSettingsView, error)
	ListGoogleCalendarEvents(ctx context.Context, userID string, timeMin, timeMax time.Time) ([]googleadapter.CalendarEvent, error)
}

type trackerService struct {
	repo             Repository
	google           *googleadapter.Client
	honeCallbackURL  string
}

type Deps struct {
	Repo            Repository
	Google          *googleadapter.Client
	HoneCallbackURL string
}

func New(deps Deps) Service {
	callback := deps.HoneCallbackURL
	if callback == "" {
		callback = "hone://settings"
	}
	return &trackerService{repo: deps.Repo, google: deps.Google, honeCallbackURL: callback}
}
