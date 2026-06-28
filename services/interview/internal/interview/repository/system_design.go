package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

var ErrVersionConflict = errors.New("workspace version conflict")

func emptyJSONObj() json.RawMessage {
	return json.RawMessage("{}")
}

func (r *Repository) GetSystemDesignWorkspace(ctx context.Context, sessionTaskID string) (*interviewmodel.SystemDesignWorkspace, error) {
	row := r.conn(ctx).QueryRow(ctx, `
		SELECT session_task_id, user_id, session_id, task_id, phase,
		       functional_context, nfr, diagram, api_spec, data_model, infrastructure,
		       wrap_up, version, phase_started_at, created_at, updated_at
		FROM system_design_workspaces
		WHERE session_task_id = $1
	`, sessionTaskID)
	return scanSystemDesignWorkspace(row)
}

func (r *Repository) CreateSystemDesignWorkspace(ctx context.Context, ws *interviewmodel.SystemDesignWorkspace) error {
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO system_design_workspaces (
			session_task_id, user_id, session_id, task_id, phase,
			functional_context, nfr, diagram, api_spec, data_model, infrastructure,
			wrap_up, version, phase_started_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
	`, ws.SessionTaskID, ws.UserID, ws.SessionID, ws.TaskID, string(ws.Phase),
		defaultJSON(ws.FunctionalContext), defaultJSON(ws.NFR), defaultJSON(ws.Diagram),
		defaultJSON(ws.APISpec), defaultJSON(ws.DataModel), defaultJSON(ws.Infrastructure),
		ws.WrapUp, ws.Version, ws.PhaseStartedAt, ws.CreatedAt, ws.UpdatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return ErrConflict
		}
		return fmt.Errorf("insert sd workspace: %w", err)
	}
	return nil
}

func (r *Repository) PatchSystemDesignWorkspace(ctx context.Context, in interviewmodel.PatchSystemDesignWorkspaceInput) (*interviewmodel.SystemDesignWorkspace, error) {
	now := time.Now().UTC()
	row := r.conn(ctx).QueryRow(ctx, `
		UPDATE system_design_workspaces SET
			phase = COALESCE($3, phase),
			functional_context = COALESCE($4, functional_context),
			nfr = COALESCE($5, nfr),
			diagram = COALESCE($6, diagram),
			api_spec = COALESCE($7, api_spec),
			data_model = COALESCE($8, data_model),
			infrastructure = COALESCE($9, infrastructure),
			wrap_up = COALESCE($10, wrap_up),
			version = version + 1,
			phase_started_at = CASE WHEN $3 IS NOT NULL AND $3::text <> phase THEN $11 ELSE phase_started_at END,
			updated_at = $11
		WHERE session_task_id = $1 AND user_id = $2 AND version = $12
		RETURNING session_task_id, user_id, session_id, task_id, phase,
		          functional_context, nfr, diagram, api_spec, data_model, infrastructure,
		          wrap_up, version, phase_started_at, created_at, updated_at
	`, in.SessionTaskID, in.UserID, phasePtr(in.Phase),
		jsonOrNil(in.FunctionalContext), jsonOrNil(in.NFR), jsonOrNil(in.Diagram),
		jsonOrNil(in.APISpec), jsonOrNil(in.DataModel), jsonOrNil(in.Infrastructure),
		in.WrapUp, now, in.ExpectedVersion)
	ws, err := scanSystemDesignWorkspace(row)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return nil, ErrVersionConflict
		}
		return nil, err
	}
	return ws, nil
}

func (r *Repository) ListSystemDesignTurns(ctx context.Context, sessionTaskID string, limit int) ([]interviewmodel.SystemDesignTurn, error) {
	if limit <= 0 {
		limit = 100
	}
	rows, err := r.conn(ctx).Query(ctx, `
		SELECT id, session_task_id, phase, role, content, metadata, created_at
		FROM system_design_turns
		WHERE session_task_id = $1
		ORDER BY created_at ASC
		LIMIT $2
	`, sessionTaskID, limit)
	if err != nil {
		return nil, fmt.Errorf("list sd turns: %w", err)
	}
	defer rows.Close()
	var out []interviewmodel.SystemDesignTurn
	for rows.Next() {
		t, err := scanSystemDesignTurn(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *t)
	}
	return out, rows.Err()
}

func (r *Repository) CreateSystemDesignTurn(ctx context.Context, turn *interviewmodel.SystemDesignTurn) error {
	_, err := r.conn(ctx).Exec(ctx, `
		INSERT INTO system_design_turns (id, session_task_id, phase, role, content, metadata, created_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, turn.ID, turn.SessionTaskID, string(turn.Phase), string(turn.Role),
		turn.Content, defaultJSON(turn.Metadata), turn.CreatedAt)
	if err != nil {
		return fmt.Errorf("insert sd turn: %w", err)
	}
	return nil
}

func scanSystemDesignWorkspace(row pgx.Row) (*interviewmodel.SystemDesignWorkspace, error) {
	var ws interviewmodel.SystemDesignWorkspace
	var phase, fc, nfr, diagram, apiSpec, dataModel, infra json.RawMessage
	err := row.Scan(
		&ws.SessionTaskID, &ws.UserID, &ws.SessionID, &ws.TaskID, &phase,
		&fc, &nfr, &diagram, &apiSpec, &dataModel, &infra,
		&ws.WrapUp, &ws.Version, &ws.PhaseStartedAt, &ws.CreatedAt, &ws.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan sd workspace: %w", err)
	}
	ws.Phase = interviewmodel.SystemDesignPhase(phase)
	ws.FunctionalContext = fc
	ws.NFR = nfr
	ws.Diagram = diagram
	ws.APISpec = apiSpec
	ws.DataModel = dataModel
	ws.Infrastructure = infra
	return &ws, nil
}

func scanSystemDesignTurn(row pgx.Row) (*interviewmodel.SystemDesignTurn, error) {
	var t interviewmodel.SystemDesignTurn
	var phase, role string
	var metadata json.RawMessage
	err := row.Scan(&t.ID, &t.SessionTaskID, &phase, &role, &t.Content, &metadata, &t.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("scan sd turn: %w", err)
	}
	t.Phase = interviewmodel.SystemDesignPhase(phase)
	t.Role = interviewmodel.SystemDesignTurnRole(role)
	t.Metadata = metadata
	return &t, nil
}

func defaultJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return emptyJSONObj()
	}
	return raw
}

func jsonOrNil(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}

func phasePtr(p *interviewmodel.SystemDesignPhase) any {
	if p == nil {
		return nil
	}
	return string(*p)
}
