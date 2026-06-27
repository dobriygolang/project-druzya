package service

import (
	"context"
	cryptorand "crypto/rand"
	"encoding/binary"
	"encoding/json"
	"fmt"
	mathrand "math/rand/v2"
	"time"

	"github.com/google/uuid"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

func (s *interviewService) StartInterviewSession(
	ctx context.Context,
	userID string,
	templateID *string,
	mode interviewmodel.SessionMode,
) (*interviewmodel.SessionDetail, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}
	if mode == interviewmodel.ModeCompanyInterview && (templateID == nil || *templateID == "") {
		return nil, fmt.Errorf("template_id required for company_interview: %w", ErrInvalidInput)
	}
	if mode == interviewmodel.ModeRetryMistakes {
		return nil, fmt.Errorf("use StartRetrySession for retry_mistakes: %w", ErrInvalidInput)
	}
	if err := s.gateSessionStart(ctx, userID, mode); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	sessionID := uuid.NewString()
	passingScore := 85
	var sections []interviewmodel.SessionSection
	var tasks []interviewmodel.SessionTask

	switch mode {
	case interviewmodel.ModeCompanyInterview:
		detail, err := s.content.GetInterviewTemplateDetail(ctx, *templateID)
		if err != nil {
			return nil, mapContentError(err)
		}
		passingScore = detail.PassingScore
		sections, tasks = buildSectionsFromTemplate(sessionID, detail, now)
	default:
		taskType, ok := interviewmodel.TaskTypeForMode[mode]
		if !ok {
			return nil, fmt.Errorf("unsupported training mode: %w", ErrInvalidInput)
		}
		catalogTasks, err := s.content.ListTasks(ctx, taskType, s.trainingLimit)
		if err != nil {
			return nil, mapContentError(err)
		}
		if len(catalogTasks) == 0 {
			return nil, fmt.Errorf("no tasks available: %w", ErrNotFound)
		}
		shuffleTasks(catalogTasks)
		sections, tasks = buildTrainingSection(sessionID, taskType, catalogTasks, now)
	}

	session := interviewmodel.Session{
		ID:           sessionID,
		UserID:       userID,
		TemplateID:   templateID,
		Mode:         mode,
		Status:       interviewmodel.SessionStatusActive,
		StartedAt:    now,
		PassingScore: passingScore,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.CreateSessionBundle(ctx, interviewrepo.SessionBundle{
		Session:  session,
		Sections: sections,
		Tasks:    tasks,
	}); err != nil {
		return nil, err
	}

	_ = s.events.Publish(ctx, eventsadapter.Event{
		Name: eventsadapter.SessionStarted,
		Payload: map[string]any{
			"session_id": sessionID,
			"user_id":    userID,
			"mode":       string(mode),
		},
	})

	return &interviewmodel.SessionDetail{
		Session:  &session,
		Sections: sections,
		Tasks:    tasks,
		Progress: computeProgress(sections, tasks),
	}, nil
}

func buildSectionsFromTemplate(sessionID string, detail *contentadapter.TemplateDetail, now time.Time) ([]interviewmodel.SessionSection, []interviewmodel.SessionTask) {
	sections := make([]interviewmodel.SessionSection, 0, len(detail.Sections))
	tasks := make([]interviewmodel.SessionTask, 0)

	for i, src := range detail.Sections {
		secID := uuid.NewString()
		status := interviewmodel.SectionStatusPending
		if i == 0 {
			status = interviewmodel.SectionStatusActive
		}
		sections = append(sections, interviewmodel.SessionSection{
			ID:           secID,
			SessionID:    sessionID,
			SectionType:  src.SectionType,
			Title:        src.Title,
			Position:     src.Position,
			Status:       status,
			PassingScore: src.PassingScore,
			CreatedAt:    now,
			UpdatedAt:    now,
		})
		for pos, taskID := range src.TaskIDs {
			tasks = append(tasks, interviewmodel.SessionTask{
				ID:        uuid.NewString(),
				SessionID: sessionID,
				SectionID: secID,
				TaskID:    taskID,
				Position:  pos + 1,
				Status:    interviewmodel.SessionTaskAssigned,
				CreatedAt: now,
				UpdatedAt: now,
			})
		}
	}
	return sections, tasks
}

func buildTrainingSection(sessionID, taskType string, catalogTasks []contentadapter.Task, now time.Time) ([]interviewmodel.SessionSection, []interviewmodel.SessionTask) {
	secID := uuid.NewString()
	section := interviewmodel.SessionSection{
		ID:          secID,
		SessionID:   sessionID,
		SectionType: taskType,
		Title:       taskType + " training",
		Position:    1,
		Status:      interviewmodel.SectionStatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	tasks := make([]interviewmodel.SessionTask, 0, len(catalogTasks))
	for i, t := range catalogTasks {
		tasks = append(tasks, interviewmodel.SessionTask{
			ID:        uuid.NewString(),
			SessionID: sessionID,
			SectionID: secID,
			TaskID:    t.ID,
			Position:  i + 1,
			Status:    interviewmodel.SessionTaskAssigned,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}
	return []interviewmodel.SessionSection{section}, tasks
}

func (s *interviewService) GetInterviewSession(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionDetail, error) {
	session, sections, tasks, err := s.loadSessionTree(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	return &interviewmodel.SessionDetail{
		Session:  session,
		Sections: sections,
		Tasks:    tasks,
		Progress: computeProgress(sections, tasks),
	}, nil
}

func (s *interviewService) GetCurrentSessionState(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionState, error) {
	session, sections, tasks, err := s.loadSessionTree(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	currentSection := findCurrentSection(sections)
	return &interviewmodel.SessionState{
		Session:        session,
		CurrentSection: currentSection,
		CurrentTask:    findCurrentTask(currentSection, tasks),
		Progress:       computeProgress(sections, tasks),
	}, nil
}

func (s *interviewService) GetSessionResults(ctx context.Context, userID, sessionID string) (*interviewmodel.SessionResults, error) {
	session, sections, tasks, err := s.loadSessionTree(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	evals, err := s.repo.ListEvaluationsBySession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	return &interviewmodel.SessionResults{
		Session:     session,
		Sections:    sections,
		Tasks:       tasks,
		Evaluations: evals,
		Progress:    computeProgress(sections, tasks),
	}, nil
}

func (s *interviewService) CancelSession(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, error) {
	session, err := s.repo.GetSessionForUser(ctx, userID, sessionID)
	if err != nil {
		return nil, err
	}
	if session.Status != interviewmodel.SessionStatusActive {
		return nil, fmt.Errorf("session not active: %w", ErrInvalidInput)
	}
	now := time.Now().UTC()
	session.Status = interviewmodel.SessionStatusCancelled
	session.UpdatedAt = now
	if err := s.repo.UpdateSession(ctx, session); err != nil {
		return nil, err
	}
	return session, nil
}

func (s *interviewService) loadSessionTree(ctx context.Context, userID, sessionID string) (*interviewmodel.Session, []interviewmodel.SessionSection, []interviewmodel.SessionTask, error) {
	session, err := s.repo.GetSessionForUser(ctx, userID, sessionID)
	if err != nil {
		return nil, nil, nil, err
	}
	if err := s.expireIfNeeded(ctx, session); err != nil {
		return nil, nil, nil, err
	}
	sections, err := s.repo.ListSectionsBySession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, err
	}
	tasks, err := s.repo.ListTasksBySession(ctx, sessionID)
	if err != nil {
		return nil, nil, nil, err
	}
	return session, sections, tasks, nil
}

func shuffleTasks(tasks []contentadapter.Task) {
	if len(tasks) < 2 {
		return
	}
	var seed uint64
	if err := binary.Read(cryptorand.Reader, binary.LittleEndian, &seed); err != nil {
		seed = uint64(time.Now().UnixNano())
	}
	rng := mathrand.New(mathrand.NewPCG(seed, seed^0x9e3779b97f4a7c15))
	rng.Shuffle(len(tasks), func(i, j int) {
		tasks[i], tasks[j] = tasks[j], tasks[i]
	})
}

func encodeAttachments(items []interviewmodel.Attachment) json.RawMessage {
	if len(items) == 0 {
		return json.RawMessage("[]")
	}
	b, _ := json.Marshal(items)
	return b
}
