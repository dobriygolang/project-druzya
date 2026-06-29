package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	googleadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/google"
	identityadapter "github.com/sedorofeevd/project-druzya/services/tracker/internal/adapter/identity"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/repository"
	"github.com/sedorofeevd/project-druzya/services/tracker/pkg/classify"
)

type Repository interface {
	ListProjectsByUser(ctx context.Context, userID string) ([]model.Project, error)
	GetProject(ctx context.Context, projectID, userID string) (*model.Project, error)
	CreateProject(ctx context.Context, userID, name string) (*model.Project, error)
	ListEpicsByProject(ctx context.Context, projectID string) ([]model.Epic, error)
	CreateEpic(ctx context.Context, projectID, name string) (*model.Epic, error)
	FindEpicByName(ctx context.Context, projectID, name string) (*model.Epic, error)
	GetActiveSprint(ctx context.Context, projectID string) (*model.Sprint, error)
	CreateSprint(ctx context.Context, projectID, name, goal string) (*model.Sprint, error)
	ArchiveSprint(ctx context.Context, sprintID, userID string) (*model.Sprint, error)
	ListArchivedSprints(ctx context.Context, projectID string) ([]model.Sprint, error)
	ListTasksBySprint(ctx context.Context, sprintID string) ([]model.Task, error)
	CreateTask(ctx context.Context, in repository.CreateTaskInput) (*model.Task, bool, error)
	GetTask(ctx context.Context, taskID, userID string) (*model.Task, error)
	UpdateTask(ctx context.Context, taskID, userID string, patch repository.TaskPatch) (*model.Task, error)
	InsertOutbox(ctx context.Context, eventName string, payload map[string]any) error
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]model.OutboxMessage, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id, errMsg string, retryDelay time.Duration) error
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
	GetUserSettings(ctx context.Context, userID string) (*model.UserSettings, error)
	UpsertUserSettings(ctx context.Context, userID string, smartParse, googleSync *bool) (*model.UserSettings, error)
	SetDeferredSprintEpicNames(ctx context.Context, userID string, names []string) (*model.UserSettings, error)
	ClearDeferredSprintEpics(ctx context.Context, userID string) error
	SaveGoogleOAuthState(ctx context.Context, userID, state string) error
	ConsumeGoogleOAuthState(ctx context.Context, state string) (string, error)
	SaveGoogleRefreshToken(ctx context.Context, userID, refreshToken string) error
	ClearGoogleRefreshToken(ctx context.Context, userID string) error
	PatchTaskMetadata(ctx context.Context, taskID, userID string, patch map[string]any) (*model.Task, error)
	SumEstimateDaysBySprint(ctx context.Context, sprintID string, excludeTaskID *string) (float64, error)
	SyncEpicStatus(ctx context.Context, epicID string) error
	ReopenEpic(ctx context.Context, epicID, userID string) (*model.Epic, error)
	ListWorkTasksByUser(ctx context.Context, userID string) ([]model.Task, error)
	CreateWorkTask(ctx context.Context, sprintID, userID, title string, meta map[string]any, boardStatus string) (*model.Task, error)
	PatchWorkTask(ctx context.Context, taskID, userID string, patch repository.WorkTaskPatch) (*model.Task, error)
}

type Service interface {
	GetBoard(ctx context.Context, userID string, projectID *string) (*model.Board, error)
	CreateProject(ctx context.Context, userID, name string) (*model.Project, error)
	CreateEpic(ctx context.Context, userID, projectID, name string) (*model.Epic, error)
	ReopenEpic(ctx context.Context, userID, epicID string) (*model.Epic, error)
	CreateSprint(ctx context.Context, userID, projectID string, name, goal *string) (*model.Sprint, error)
	CreateTask(ctx context.Context, userID string, in CreateTaskParams) (*model.Task, error)
	UpdateTask(ctx context.Context, userID string, in UpdateTaskParams) (*model.Task, error)
	ListSprintTasks(ctx context.Context, userID, sprintID string) ([]model.Task, error)
	ArchiveSprint(ctx context.Context, userID, sprintID string) (*model.Sprint, error)
	ExportBoard(ctx context.Context, userID string, projectID *string) (string, error)
	EnsureLearningBoard(ctx context.Context, userID string) (*model.LearningBoard, error)
	CreateTaskInternal(ctx context.Context, in InternalCreateTaskParams) (*model.Task, bool, error)
	GetSprintPreview(ctx context.Context, userID string, limit int) ([]model.Task, *model.Sprint, error)
	GetToday(ctx context.Context, userID string, localDate, timezone *string) (*model.TodayView, error)
	ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]model.OutboxMessage, error)
	AckOutboxEvents(ctx context.Context, ids []string) error
	FailOutboxEvent(ctx context.Context, id, errMsg string) error
	GetSettings(ctx context.Context, userID string) (*model.UserSettingsView, error)
	UpdateSettings(ctx context.Context, userID string, in UpdateSettingsParams) (*model.UserSettingsView, error)
	UpdateEpicSprintScope(ctx context.Context, userID, epicID string, deferred bool) (*model.UserSettingsView, error)
	GetGoogleCalendarAuthURL(ctx context.Context, userID string) (string, error)
	HandleGoogleCallback(ctx context.Context, code, state string) (string, error)
	DisconnectGoogleCalendar(ctx context.Context, userID string) (*model.UserSettingsView, error)
	GetUserSettings(ctx context.Context, userID string) (*model.UserSettingsView, error)
	PatchTaskMetadata(ctx context.Context, userID, taskID string, patch map[string]any) (*model.Task, error)

	ListWorkTasks(ctx context.Context, userID string) ([]WorkTask, error)
	CreateWorkTask(ctx context.Context, userID string, in CreateWorkTaskParams) (*WorkTask, error)
	UpdateWorkTaskStatus(ctx context.Context, userID, taskID, status string) (*WorkTask, error)
	DeleteWorkTask(ctx context.Context, userID, taskID string) error
	ScheduleWorkTask(ctx context.Context, userID, taskID, startISO string, durationMin int) (*WorkTask, error)
	UnscheduleWorkTask(ctx context.Context, userID, taskID string) (*WorkTask, error)
	UpdateWorkTaskKind(ctx context.Context, userID, taskID, kind string, manualOverride bool) (*WorkTask, error)
}

type CreateTaskParams struct {
	SprintID     string
	Title        string
	EpicID       *string
	EstimateDays *float64
	Source       model.TaskSource
	Metadata     map[string]any
	DedupKey     *string
}

type UpdateTaskParams struct {
	TaskID       string
	Title        *string
	Done         *bool
	EpicID       *string
	Position     *int
	EstimateDays *float64
	Archived     *bool
}

type InternalCreateTaskParams struct {
	UserID       string
	Title        string
	Source       model.TaskSource
	Metadata     map[string]any
	DedupKey     *string
	EpicName     *string
	EstimateDays *float64
}

type trackerService struct {
	repo        Repository
	google      *googleadapter.Client
	frontendURL string
	identity    identityadapter.Client
}

type Deps struct {
	Repo        Repository
	Google      *googleadapter.Client
	FrontendURL string
	Identity    identityadapter.Client
}

func New(deps Deps) Service {
	frontend := deps.FrontendURL
	if frontend == "" {
		frontend = "http://localhost:5173"
	}
	return &trackerService{repo: deps.Repo, google: deps.Google, frontendURL: frontend, identity: deps.Identity}
}

func (s *trackerService) GetBoard(ctx context.Context, userID string, projectID *string) (*model.Board, error) {
	if projectID != nil && *projectID != "" {
		project, err := s.repo.GetProject(ctx, *projectID, userID)
		if err != nil {
			return nil, err
		}
		return s.buildBoard(ctx, project)
	}
	return s.ensureDefaultBoard(ctx, userID)
}

func (s *trackerService) ensureDefaultBoard(ctx context.Context, userID string) (*model.Board, error) {
	projects, err := s.repo.ListProjectsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(projects) == 0 {
		if _, err := s.EnsureLearningBoard(ctx, userID); err != nil {
			return nil, err
		}
		projects, err = s.repo.ListProjectsByUser(ctx, userID)
		if err != nil {
			return nil, err
		}
	}
	if len(projects) == 0 {
		return &model.Board{}, nil
	}
	return s.buildBoard(ctx, &projects[0])
}

func (s *trackerService) buildBoard(ctx context.Context, project *model.Project) (*model.Board, error) {
	epics, err := s.repo.ListEpicsByProject(ctx, project.ID)
	if err != nil {
		return nil, err
	}
	for _, e := range epics {
		if err := s.repo.SyncEpicStatus(ctx, e.ID); err != nil {
			return nil, err
		}
	}
	epics, err = s.repo.ListEpicsByProject(ctx, project.ID)
	if err != nil {
		return nil, err
	}
	active, err := s.repo.GetActiveSprint(ctx, project.ID)
	if err != nil && !errors.Is(err, repository.ErrNotFound) {
		return nil, err
	}
	var tasks []model.Task
	if active != nil {
		tasks, err = s.repo.ListTasksBySprint(ctx, active.ID)
		if err != nil {
			return nil, err
		}
	}
	archived, err := s.repo.ListArchivedSprints(ctx, project.ID)
	if err != nil {
		return nil, err
	}
	if active != nil {
		used, err := s.repo.SumEstimateDaysBySprint(ctx, active.ID, nil)
		if err != nil {
			return nil, err
		}
		active.EstimateDaysUsed = used
		active.EstimateDaysCapacity = model.SprintCapacityDays
	}
	return &model.Board{Project: project, Epics: epics, ActiveSprint: active, Tasks: tasks, ArchivedSprints: archived}, nil
}

func (s *trackerService) CreateProject(ctx context.Context, userID, name string) (*model.Project, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: name required", model.ErrInvalidArgument)
	}
	var project *model.Project
	err := s.repo.WithTx(ctx, func(txCtx context.Context) error {
		p, err := s.repo.CreateProject(txCtx, userID, name)
		if err != nil {
			return err
		}
		project = p
		_, err = s.repo.CreateSprint(txCtx, p.ID, model.DefaultSprintName, "")
		return err
	})
	return project, err
}

func (s *trackerService) CreateEpic(ctx context.Context, userID, projectID, name string) (*model.Epic, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: name required", model.ErrInvalidArgument)
	}
	if _, err := s.repo.GetProject(ctx, projectID, userID); err != nil {
		return nil, err
	}
	return s.repo.CreateEpic(ctx, projectID, name)
}

func (s *trackerService) ReopenEpic(ctx context.Context, userID, epicID string) (*model.Epic, error) {
	epic, err := s.repo.ReopenEpic(ctx, epicID, userID)
	if err != nil {
		return nil, err
	}
	epics, err := s.repo.ListEpicsByProject(ctx, epic.ProjectID)
	if err != nil {
		return nil, err
	}
	for i := range epics {
		if epics[i].ID == epicID {
			return &epics[i], nil
		}
	}
	return epic, nil
}

func (s *trackerService) CreateSprint(ctx context.Context, userID, projectID string, name, goal *string) (*model.Sprint, error) {
	if _, err := s.repo.GetProject(ctx, projectID, userID); err != nil {
		return nil, err
	}
	sprintName := model.DefaultSprintName
	if name != nil && strings.TrimSpace(*name) != "" {
		sprintName = strings.TrimSpace(*name)
	}
	goalText := ""
	if goal != nil {
		goalText = strings.TrimSpace(*goal)
	}
	sprint, err := s.repo.CreateSprint(ctx, projectID, sprintName, goalText)
	if err != nil {
		return nil, err
	}
	_ = s.repo.ClearDeferredSprintEpics(ctx, userID)
	return sprint, nil
}

func (s *trackerService) CreateTask(ctx context.Context, userID string, in CreateTaskParams) (*model.Task, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, fmt.Errorf("%w: title required", model.ErrInvalidArgument)
	}
	if _, err := s.getSprintForUser(ctx, in.SprintID, userID); err != nil {
		return nil, err
	}
	source := in.Source
	if source == "" {
		source = model.TaskSourceUser
	}
	meta := in.Metadata
	if meta == nil {
		meta = map[string]any{}
	}
	epicID := in.EpicID
	switch source {
	case model.TaskSourceUser:
		cr := classify.Title(title)
		meta["task_kind"] = cr.Kind
		for k, v := range cr.Meta {
			meta[k] = v
		}
		if len(cr.Signals) > 0 {
			meta["classify_signals"] = cr.Signals
		}
		if epicID == nil && cr.EpicHint != nil {
			sprint, err := s.getSprintForUser(ctx, in.SprintID, userID)
			if err == nil {
				if epic, err := s.repo.FindEpicByName(ctx, sprint.ProjectID, *cr.EpicHint); err == nil {
					id := epic.ID
					epicID = &id
				} else if errors.Is(err, repository.ErrNotFound) {
					if created, err := s.repo.CreateEpic(ctx, sprint.ProjectID, *cr.EpicHint); err == nil {
						id := created.ID
						epicID = &id
					}
				}
			}
		}
	case model.TaskSourceRecommendation, model.TaskSourceEnrichment:
		if _, ok := meta["task_kind"]; !ok {
			meta["task_kind"] = classify.KindSystem
		}
	}
	estimate := model.DefaultTaskEstimateDays
	if in.EstimateDays != nil {
		normalized, err := model.NormalizeEstimateDays(*in.EstimateDays)
		if err != nil {
			return nil, err
		}
		estimate = normalized
	}
	var task *model.Task
	err := s.repo.WithTx(ctx, func(txCtx context.Context) error {
		t, created, err := s.repo.CreateTask(txCtx, repository.CreateTaskInput{
			SprintID: in.SprintID, EpicID: epicID, Title: title, EstimateDays: estimate,
			Source: source, Metadata: meta, DedupKey: in.DedupKey,
		})
		if err != nil {
			return err
		}
		task = t
		if err := s.syncEpicsForTask(txCtx, epicID); err != nil {
			return err
		}
		if created {
			return s.emitTaskEvent(txCtx, model.EventTaskCreated, userID, t)
		}
		return nil
	})
	if err == nil && task != nil {
		s.syncGoogleCalendarOnChange(ctx, userID, nil, task)
	}
	return task, err
}

func (s *trackerService) UpdateTask(ctx context.Context, userID string, in UpdateTaskParams) (*model.Task, error) {
	before, err := s.repo.GetTask(ctx, in.TaskID, userID)
	if err != nil {
		return nil, err
	}
	nextEstimate := before.EstimateDays
	if in.EstimateDays != nil {
		normalized, err := model.NormalizeEstimateDays(*in.EstimateDays)
		if err != nil {
			return nil, err
		}
		nextEstimate = normalized
	}
	var updated *model.Task
	err = s.repo.WithTx(ctx, func(txCtx context.Context) error {
		t, err := s.repo.UpdateTask(txCtx, in.TaskID, userID, repository.TaskPatch{
			Title: in.Title, Done: in.Done, EpicID: in.EpicID, Position: in.Position,
			EstimateDays: func() *float64 {
				if in.EstimateDays == nil {
					return nil
				}
				v := nextEstimate
				return &v
			}(),
		})
		if err != nil {
			return err
		}
		if in.Archived != nil {
			t, err = s.repo.PatchTaskMetadata(txCtx, in.TaskID, userID, map[string]any{"archived": *in.Archived})
			if err != nil {
				return err
			}
		}
		updated = t
		if err := s.syncEpicsForTask(txCtx, before.EpicID, updated.EpicID); err != nil {
			return err
		}
		if in.Done != nil && *in.Done && !before.Done {
			return s.emitTaskEvent(txCtx, model.EventTaskCompleted, userID, t)
		}
		return nil
	})
	if err == nil && updated != nil {
		s.syncGoogleCalendarOnChange(ctx, userID, before, updated)
	}
	return updated, err
}

func (s *trackerService) ListSprintTasks(ctx context.Context, userID, sprintID string) ([]model.Task, error) {
	if _, err := s.getSprintForUser(ctx, sprintID, userID); err != nil {
		return nil, err
	}
	return s.repo.ListTasksBySprint(ctx, sprintID)
}

func (s *trackerService) ArchiveSprint(ctx context.Context, userID, sprintID string) (*model.Sprint, error) {
	if _, err := s.getSprintForUser(ctx, sprintID, userID); err != nil {
		return nil, err
	}
	return s.repo.ArchiveSprint(ctx, sprintID, userID)
}

func (s *trackerService) ExportBoard(ctx context.Context, userID string, projectID *string) (string, error) {
	board, err := s.GetBoard(ctx, userID, projectID)
	if err != nil {
		return "", err
	}
	if board.Project == nil {
		return "# Tracker\n\n(empty)\n", nil
	}
	var b strings.Builder
	fmt.Fprintf(&b, "# %s\n\n", board.Project.Name)
	if board.ActiveSprint != nil {
		fmt.Fprintf(&b, "## Sprint: %s\n", board.ActiveSprint.Name)
		if board.ActiveSprint.Goal != "" {
			fmt.Fprintf(&b, "Goal: %s\n\n", board.ActiveSprint.Goal)
		}
	}
	epicNames := map[string]string{}
	for _, e := range board.Epics {
		epicNames[e.ID] = e.Name
	}
	for _, t := range board.Tasks {
		box := "[ ]"
		if t.Done {
			box = "[x]"
		}
		epic := ""
		if t.EpicID != nil {
			if name, ok := epicNames[*t.EpicID]; ok {
				epic = fmt.Sprintf(" (%s)", name)
			}
		}
		fmt.Fprintf(&b, "- %s %s%s\n", box, t.Title, epic)
	}
	return b.String(), nil
}

func (s *trackerService) EnsureLearningBoard(ctx context.Context, userID string) (*model.LearningBoard, error) {
	projects, err := s.repo.ListProjectsByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(projects) == 0 {
		p, err := s.CreateProject(ctx, userID, model.DefaultProjectName)
		if err != nil {
			return nil, err
		}
		sprint, err := s.repo.GetActiveSprint(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		return &model.LearningBoard{ProjectID: p.ID, SprintID: sprint.ID}, nil
	}
	projectID := projects[0].ID
	sprint, err := s.repo.GetActiveSprint(ctx, projectID)
	if errors.Is(err, repository.ErrNotFound) {
		sprint, err = s.repo.CreateSprint(ctx, projectID, model.DefaultSprintName, "")
	}
	if err != nil {
		return nil, err
	}
	return &model.LearningBoard{ProjectID: projectID, SprintID: sprint.ID}, nil
}

func (s *trackerService) CreateTaskInternal(ctx context.Context, in InternalCreateTaskParams) (*model.Task, bool, error) {
	if in.DedupKey == nil || strings.TrimSpace(*in.DedupKey) == "" {
		return nil, false, fmt.Errorf("%w: dedup_key is required for internal task create", model.ErrInvalidArgument)
	}
	board, err := s.EnsureLearningBoard(ctx, in.UserID)
	if err != nil {
		return nil, false, err
	}
	var epicID *string
	if in.EpicName != nil && strings.TrimSpace(*in.EpicName) != "" {
		name := strings.TrimSpace(*in.EpicName)
		epic, err := s.repo.FindEpicByName(ctx, board.ProjectID, name)
		if errors.Is(err, repository.ErrNotFound) {
			created, err := s.repo.CreateEpic(ctx, board.ProjectID, name)
			if err != nil {
				return nil, false, err
			}
			epicID = &created.ID
		} else if err != nil {
			return nil, false, err
		} else {
			epicID = &epic.ID
		}
	}
	meta := in.Metadata
	if meta == nil {
		meta = map[string]any{}
	}
	source := in.Source
	if source == "" {
		source = model.TaskSourceRecommendation
	}
	estimate := model.DefaultTaskEstimateDays
	if in.EstimateDays != nil {
		normalized, err := model.NormalizeEstimateDays(*in.EstimateDays)
		if err != nil {
			return nil, false, err
		}
		estimate = normalized
	}
	var task *model.Task
	var created bool
	err = s.repo.WithTx(ctx, func(txCtx context.Context) error {
		t, ok, err := s.repo.CreateTask(txCtx, repository.CreateTaskInput{
			SprintID: board.SprintID, EpicID: epicID, Title: strings.TrimSpace(in.Title),
			EstimateDays: estimate,
			Source: source, Metadata: meta, DedupKey: in.DedupKey,
		})
		if err != nil {
			return err
		}
		task = t
		created = ok
		if err := s.syncEpicsForTask(txCtx, epicID); err != nil {
			return err
		}
		if ok && source == model.TaskSourceUser {
			return s.emitTaskEvent(txCtx, model.EventTaskCreated, in.UserID, t)
		}
		return nil
	})
	return task, created, err
}

func (s *trackerService) GetSprintPreview(ctx context.Context, userID string, limit int) ([]model.Task, *model.Sprint, error) {
	if limit <= 0 {
		limit = 3
	}
	board, err := s.EnsureLearningBoard(ctx, userID)
	if err != nil {
		return nil, nil, err
	}
	sprint, err := s.repo.GetActiveSprint(ctx, board.ProjectID)
	if err != nil {
		return nil, nil, err
	}
	tasks, err := s.repo.ListTasksBySprint(ctx, sprint.ID)
	if err != nil {
		return nil, nil, err
	}
	var open []model.Task
	for _, t := range tasks {
		if !t.Done {
			open = append(open, t)
		}
		if len(open) >= limit {
			break
		}
	}
	return open, sprint, nil
}

func (s *trackerService) ClaimOutboxEvents(ctx context.Context, eventName string, limit int) ([]model.OutboxMessage, error) {
	return s.repo.ClaimOutboxEvents(ctx, eventName, limit)
}

func (s *trackerService) AckOutboxEvents(ctx context.Context, ids []string) error {
	return s.repo.AckOutboxEvents(ctx, ids)
}

func (s *trackerService) FailOutboxEvent(ctx context.Context, id, errMsg string) error {
	return s.repo.FailOutboxEvent(ctx, id, errMsg, 30*time.Second)
}

func (s *trackerService) emitTaskEvent(ctx context.Context, eventName, userID string, task *model.Task) error {
	payload := map[string]any{
		"task_id": task.ID, "user_id": userID, "title": task.Title,
		"source": string(task.Source), "sprint_id": task.SprintID, "metadata": task.Metadata,
	}
	if task.EpicID != nil {
		payload["epic_id"] = *task.EpicID
	}
	return s.repo.InsertOutbox(ctx, eventName, payload)
}

func (s *trackerService) getSprintForUser(ctx context.Context, sprintID, userID string) (*model.Sprint, error) {
	board, err := s.GetBoard(ctx, userID, nil)
	if err != nil {
		return nil, err
	}
	if board.Project == nil {
		return nil, repository.ErrNotFound
	}
	if board.ActiveSprint != nil && board.ActiveSprint.ID == sprintID {
		return board.ActiveSprint, nil
	}
	for _, sp := range board.ArchivedSprints {
		if sp.ID == sprintID {
			return &sp, nil
		}
	}
	active, err := s.repo.GetActiveSprint(ctx, board.Project.ID)
	if err != nil {
		return nil, err
	}
	if active.ID == sprintID {
		return active, nil
	}
	return nil, repository.ErrNotFound
}
