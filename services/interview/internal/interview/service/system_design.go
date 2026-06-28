package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	aiadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/ai"
	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	eventsadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/events"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewrepo "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/repository"
)

const sdRecentTurnLimit = 30

func (s *interviewService) ensureSystemDesignTask(ctx context.Context, sessionTask *interviewmodel.SessionTask) error {
	if sessionTask.TaskType == nil || *sessionTask.TaskType != "system_design" {
		return fmt.Errorf("task is not system_design: %w", interviewmodel.ErrInvalidInput)
	}
	task, err := s.content.GetTask(ctx, sessionTask.TaskID)
	if err != nil {
		return mapContentSDError(err)
	}
	if task.Type != "system_design" {
		return fmt.Errorf("task is not system_design: %w", interviewmodel.ErrInvalidInput)
	}
	return nil
}

func mapContentSDError(err error) error {
	if errors.Is(err, contentadapter.ErrNotFound) {
		return interviewrepo.ErrNotFound
	}
	return err
}

func (s *interviewService) GetSystemDesignWorkspace(ctx context.Context, userID, sessionTaskID string) (*interviewmodel.SystemDesignWorkspaceBundle, error) {
	sessionTask, err := s.repo.GetSessionTaskForUser(ctx, userID, sessionTaskID)
	if err != nil {
		return nil, err
	}
	session, err := s.repo.GetSessionForUser(ctx, userID, sessionTask.SessionID)
	if err != nil {
		return nil, err
	}
	if err := s.expireIfNeeded(ctx, session); err != nil {
		return nil, err
	}
	if err := s.ensureSessionActive(session); err != nil {
		return nil, err
	}
	if err := s.ensureSystemDesignTask(ctx, sessionTask); err != nil {
		return nil, err
	}

	ws, err := s.repo.GetSystemDesignWorkspace(ctx, sessionTaskID)
	if err != nil {
		if !errors.Is(err, interviewrepo.ErrNotFound) {
			return nil, err
		}
		now := time.Now().UTC()
		ws = &interviewmodel.SystemDesignWorkspace{
			SessionTaskID:     sessionTaskID,
			UserID:            userID,
			SessionID:         sessionTask.SessionID,
			TaskID:            sessionTask.TaskID,
			Phase:             interviewmodel.SDPhaseBrief,
			FunctionalContext: json.RawMessage("{}"),
			NFR:               json.RawMessage("{}"),
			Diagram:           json.RawMessage("{}"),
			APISpec:           json.RawMessage("{}"),
			DataModel:         json.RawMessage("{}"),
			Infrastructure:    json.RawMessage("{}"),
			Version:           1,
			PhaseStartedAt:    now,
			CreatedAt:         now,
			UpdatedAt:         now,
		}
		if err := s.repo.CreateSystemDesignWorkspace(ctx, ws); err != nil {
			if errors.Is(err, interviewrepo.ErrConflict) {
				ws, err = s.repo.GetSystemDesignWorkspace(ctx, sessionTaskID)
				if err != nil {
					return nil, err
				}
			} else {
				return nil, err
			}
		}
	}

	turns, err := s.repo.ListSystemDesignTurns(ctx, sessionTaskID, sdRecentTurnLimit)
	if err != nil {
		return nil, err
	}
	return &interviewmodel.SystemDesignWorkspaceBundle{Workspace: ws, RecentTurns: turns}, nil
}

func (s *interviewService) PatchSystemDesignWorkspace(ctx context.Context, in interviewmodel.PatchSystemDesignWorkspaceInput) (*interviewmodel.SystemDesignWorkspace, error) {
	if in.SessionTaskID == "" || in.UserID == "" {
		return nil, fmt.Errorf("session_task_id and user_id required: %w", interviewmodel.ErrInvalidInput)
	}
	if in.ExpectedVersion <= 0 {
		return nil, fmt.Errorf("expected_version required: %w", interviewmodel.ErrInvalidInput)
	}
	if in.Phase != nil && !in.Phase.Valid() {
		return nil, fmt.Errorf("invalid phase: %w", interviewmodel.ErrInvalidInput)
	}

	sessionTask, err := s.repo.GetSessionTaskForUser(ctx, in.UserID, in.SessionTaskID)
	if err != nil {
		return nil, err
	}
	session, err := s.repo.GetSessionForUser(ctx, in.UserID, sessionTask.SessionID)
	if err != nil {
		return nil, err
	}
	if err := s.expireIfNeeded(ctx, session); err != nil {
		return nil, err
	}
	if err := s.ensureSessionActive(session); err != nil {
		return nil, err
	}
	if err := s.ensureSystemDesignTask(ctx, sessionTask); err != nil {
		return nil, err
	}
	switch sessionTask.Status {
	case interviewmodel.SessionTaskEvaluated, interviewmodel.SessionTaskSkipped, interviewmodel.SessionTaskSubmitted:
		return nil, fmt.Errorf("task already finished: %w", interviewrepo.ErrConflict)
	}

	return s.repo.PatchSystemDesignWorkspace(ctx, in)
}

func (s *interviewService) ListSystemDesignTurns(ctx context.Context, userID, sessionTaskID string) ([]interviewmodel.SystemDesignTurn, error) {
	if _, err := s.repo.GetSessionTaskForUser(ctx, userID, sessionTaskID); err != nil {
		return nil, err
	}
	return s.repo.ListSystemDesignTurns(ctx, sessionTaskID, 200)
}

func (s *interviewService) PostSystemDesignTurn(ctx context.Context, userID, sessionTaskID, content string) (*interviewmodel.SystemDesignTurn, *interviewmodel.SystemDesignTurn, error) {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, nil, fmt.Errorf("content required: %w", interviewmodel.ErrInvalidInput)
	}
	if s.ai == nil {
		return nil, nil, fmt.Errorf("ai service not configured: %w", interviewmodel.ErrInvalidInput)
	}
	if err := s.consumeSDAITurn(ctx, userID); err != nil {
		return nil, nil, err
	}

	bundle, err := s.GetSystemDesignWorkspace(ctx, userID, sessionTaskID)
	if err != nil {
		return nil, nil, err
	}
	ws := bundle.Workspace
	task, err := s.content.GetTask(ctx, ws.TaskID)
	if err != nil {
		return nil, nil, mapContentSDError(err)
	}

	now := time.Now().UTC()
	userTurn := &interviewmodel.SystemDesignTurn{
		ID:            uuid.NewString(),
		SessionTaskID: sessionTaskID,
		Phase:         ws.Phase,
		Role:          interviewmodel.SDTurnRoleUser,
		Content:       content,
		Metadata:      json.RawMessage("{}"),
		CreatedAt:     now,
	}
	if err := s.repo.CreateSystemDesignTurn(ctx, userTurn); err != nil {
		return nil, nil, err
	}

	allTurns, err := s.repo.ListSystemDesignTurns(ctx, sessionTaskID, 50)
	if err != nil {
		return nil, nil, err
	}
	aiTurns := make([]aiadapter.TurnMessage, 0, len(allTurns))
	for _, t := range allTurns {
		aiTurns = append(aiTurns, aiadapter.TurnMessage{
			Role:    string(t.Role),
			Content: t.Content,
			Phase:   string(t.Phase),
		})
	}

	out, err := s.ai.RunSystemDesignInterviewerTurn(ctx, aiadapter.InterviewerTurnInput{
		UserID:            userID,
		TaskID:            ws.TaskID,
		Phase:             string(ws.Phase),
		Turns:             aiTurns,
		WorkspaceSnapshot: aiadapter.WorkspaceSnapshotFromJSON(
			string(ws.Phase), ws.FunctionalContext, ws.NFR, ws.Diagram,
			ws.APISpec, ws.DataModel, ws.Infrastructure, ws.WrapUp,
		),
		TaskTitle:       task.Title,
		TaskDescription: task.Description,
	})
	if err != nil {
		return userTurn, nil, err
	}

	interviewerTurn := &interviewmodel.SystemDesignTurn{
		ID:            uuid.NewString(),
		SessionTaskID: sessionTaskID,
		Phase:         ws.Phase,
		Role:          interviewmodel.SDTurnRoleInterviewer,
		Content:       out.Reply,
		Metadata:      metadataJSON(out.Metadata),
		CreatedAt:     time.Now().UTC(),
	}
	if err := s.repo.CreateSystemDesignTurn(ctx, interviewerTurn); err != nil {
		return userTurn, nil, err
	}
	return userTurn, interviewerTurn, nil
}

func (s *interviewService) RequestSystemDesignCheckpoint(ctx context.Context, userID, sessionTaskID string, diagramPNGBase64 *string) (*interviewmodel.SystemDesignTurn, error) {
	if s.ai == nil {
		return nil, fmt.Errorf("ai service not configured: %w", interviewmodel.ErrInvalidInput)
	}
	if err := s.consumeSDAITurn(ctx, userID); err != nil {
		return nil, err
	}
	bundle, err := s.GetSystemDesignWorkspace(ctx, userID, sessionTaskID)
	if err != nil {
		return nil, err
	}
	ws := bundle.Workspace
	task, err := s.content.GetTask(ctx, ws.TaskID)
	if err != nil {
		return nil, mapContentSDError(err)
	}

	out, err := s.ai.RunSystemDesignCheckpoint(ctx, aiadapter.CheckpointInput{
		UserID: userID,
		TaskID: ws.TaskID,
		Phase:  string(ws.Phase),
		WorkspaceSnapshot: aiadapter.WorkspaceSnapshotFromJSON(
			string(ws.Phase), ws.FunctionalContext, ws.NFR, ws.Diagram,
			ws.APISpec, ws.DataModel, ws.Infrastructure, ws.WrapUp,
		),
		DiagramPNGBase64: diagramPNGBase64,
		TaskTitle:        task.Title,
		TaskDescription:  task.Description,
	})
	if err != nil {
		return nil, err
	}

	turn := &interviewmodel.SystemDesignTurn{
		ID:            uuid.NewString(),
		SessionTaskID: sessionTaskID,
		Phase:         ws.Phase,
		Role:          interviewmodel.SDTurnRoleSystem,
		Content:       out.Critique,
		Metadata:      metadataJSON(out.Metadata),
		CreatedAt:     time.Now().UTC(),
	}
	if err := s.repo.CreateSystemDesignTurn(ctx, turn); err != nil {
		return nil, err
	}
	return turn, nil
}

func (s *interviewService) SubmitSystemDesign(ctx context.Context, userID, sessionTaskID string, diagramPNGBase64 *string) (*interviewmodel.Attempt, error) {
	bundle, err := s.GetSystemDesignWorkspace(ctx, userID, sessionTaskID)
	if err != nil {
		return nil, err
	}
	ws := bundle.Workspace

	sessionTask, err := s.repo.GetSessionTaskForUser(ctx, userID, sessionTaskID)
	if err != nil {
		return nil, err
	}
	session, err := s.repo.GetSessionForUser(ctx, userID, sessionTask.SessionID)
	if err != nil {
		return nil, err
	}
	switch sessionTask.Status {
	case interviewmodel.SessionTaskEvaluated, interviewmodel.SessionTaskSkipped:
		return nil, fmt.Errorf("task already finished: %w", interviewrepo.ErrConflict)
	case interviewmodel.SessionTaskSubmitted:
		return nil, fmt.Errorf("attempt already submitted: %w", interviewrepo.ErrConflict)
	}

	turns, err := s.repo.ListSystemDesignTurns(ctx, sessionTaskID, 200)
	if err != nil {
		return nil, err
	}
	dossier := map[string]any{
		"kind":           "system_design_dossier",
		"phase":          ws.Phase,
		"functional_context": jsonRawToAny(ws.FunctionalContext),
		"nfr":              jsonRawToAny(ws.NFR),
		"diagram":          jsonRawToAny(ws.Diagram),
		"api_spec":         jsonRawToAny(ws.APISpec),
		"data_model":       jsonRawToAny(ws.DataModel),
		"infrastructure":   jsonRawToAny(ws.Infrastructure),
		"turns_count":      len(turns),
	}
	if ws.WrapUp != nil {
		dossier["wrap_up"] = *ws.WrapUp
	}
	dossierBytes, err := json.Marshal(dossier)
	if err != nil {
		return nil, fmt.Errorf("marshal dossier: %w", err)
	}
	answerText := string(dossierBytes)

	now := time.Now().UTC()
	attachments := encodeSDAttachments(diagramPNGBase64)
	attempt := &interviewmodel.Attempt{
		ID:            uuid.NewString(),
		UserID:        userID,
		SessionTaskID: sessionTaskID,
		TaskID:        sessionTask.TaskID,
		AnswerText:    &answerText,
		Attachments:   attachments,
		Status:        interviewmodel.AttemptStatusEvaluating,
		SubmittedAt:   now,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	err = s.repo.WithTx(ctx, func(txCtx context.Context) error {
		if err := s.repo.CreateAttempt(txCtx, attempt); err != nil {
			return err
		}
		sessionTask.Status = interviewmodel.SessionTaskSubmitted
		sessionTask.UpdatedAt = now
		if err := s.repo.UpdateSessionTask(txCtx, sessionTask); err != nil {
			return err
		}
		submitted := interviewmodel.SDPhaseSubmitted
		if _, err := s.repo.PatchSystemDesignWorkspace(txCtx, interviewmodel.PatchSystemDesignWorkspaceInput{
			UserID:          userID,
			SessionTaskID:   sessionTaskID,
			ExpectedVersion: ws.Version,
			Phase:           &submitted,
		}); err != nil && !errors.Is(err, interviewrepo.ErrVersionConflict) {
			return err
		}
		return s.repo.InsertOutbox(txCtx, string(eventsadapter.AttemptSubmitted),
			map[string]any{
				"attempt_id":      attempt.ID,
				"user_id":         attempt.UserID,
				"task_id":         attempt.TaskID,
				"session_id":      session.ID,
				"session_task_id": sessionTaskID,
				"occurred_at":     now.Format(time.RFC3339Nano),
			})
	})
	if err != nil {
		return nil, err
	}
	return attempt, nil
}

func metadataJSON(m map[string]any) json.RawMessage {
	if len(m) == 0 {
		return json.RawMessage("{}")
	}
	b, err := json.Marshal(m)
	if err != nil {
		return json.RawMessage("{}")
	}
	return b
}

func jsonRawToAny(raw json.RawMessage) any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return map[string]any{}
	}
	return v
}

func encodeSDAttachments(diagramPNGBase64 *string) json.RawMessage {
	if diagramPNGBase64 == nil || strings.TrimSpace(*diagramPNGBase64) == "" {
		return json.RawMessage("[]")
	}
	url := strings.TrimSpace(*diagramPNGBase64)
	if !strings.HasPrefix(url, "data:") {
		url = "data:image/png;base64," + url
	}
	items := []interviewmodel.Attachment{{
		Name: "diagram.png",
		Type: "diagram_png",
		URL:  url,
	}}
	b, err := json.Marshal(items)
	if err != nil {
		return json.RawMessage("[]")
	}
	return b
}
