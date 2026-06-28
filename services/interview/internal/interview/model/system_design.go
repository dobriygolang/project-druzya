package model

import (
	"encoding/json"
	"time"
)

// SystemDesignPhase is the workspace step in the SD room flow.
type SystemDesignPhase string

const (
	SDPhaseBrief          SystemDesignPhase = "brief"
	SDPhaseClarification  SystemDesignPhase = "clarification"
	SDPhaseNFR            SystemDesignPhase = "nfr"
	SDPhaseDiagram        SystemDesignPhase = "diagram"
	SDPhaseAPI            SystemDesignPhase = "api"
	SDPhaseDataModel      SystemDesignPhase = "data_model"
	SDPhaseDeepDive       SystemDesignPhase = "deep_dive"
	SDPhaseWrapUp         SystemDesignPhase = "wrap_up"
	SDPhaseSubmitted      SystemDesignPhase = "submitted"
)

// ValidSystemDesignPhases lists editable phases (excludes submitted).
var ValidSystemDesignPhases = []SystemDesignPhase{
	SDPhaseBrief,
	SDPhaseClarification,
	SDPhaseNFR,
	SDPhaseDiagram,
	SDPhaseAPI,
	SDPhaseDataModel,
	SDPhaseDeepDive,
	SDPhaseWrapUp,
}

func (p SystemDesignPhase) Valid() bool {
	switch p {
	case SDPhaseBrief, SDPhaseClarification, SDPhaseNFR, SDPhaseDiagram,
		SDPhaseAPI, SDPhaseDataModel, SDPhaseDeepDive, SDPhaseWrapUp, SDPhaseSubmitted:
		return true
	default:
		return false
	}
}

// SystemDesignTurnRole is chat/checkpoint author.
type SystemDesignTurnRole string

const (
	SDTurnRoleUser        SystemDesignTurnRole = "user"
	SDTurnRoleInterviewer SystemDesignTurnRole = "interviewer"
	SDTurnRoleSystem      SystemDesignTurnRole = "system"
)

// SystemDesignWorkspace holds autosaved SD room state.
type SystemDesignWorkspace struct {
	SessionTaskID      string
	UserID             string
	SessionID          string
	TaskID             string
	Phase              SystemDesignPhase
	FunctionalContext  json.RawMessage
	NFR                json.RawMessage
	Diagram            json.RawMessage
	APISpec            json.RawMessage
	DataModel          json.RawMessage
	Infrastructure     json.RawMessage
	WrapUp             *string
	Version            int
	PhaseStartedAt     time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// SystemDesignTurn is one chat or checkpoint message.
type SystemDesignTurn struct {
	ID            string
	SessionTaskID string
	Phase         SystemDesignPhase
	Role          SystemDesignTurnRole
	Content       string
	Metadata      json.RawMessage
	CreatedAt     time.Time
}

// SystemDesignWorkspaceBundle is workspace plus recent chat history.
type SystemDesignWorkspaceBundle struct {
	Workspace    *SystemDesignWorkspace
	RecentTurns  []SystemDesignTurn
}

// PatchSystemDesignWorkspaceInput partial update with optimistic locking.
type PatchSystemDesignWorkspaceInput struct {
	UserID            string
	SessionTaskID     string
	ExpectedVersion   int
	Phase             *SystemDesignPhase
	FunctionalContext json.RawMessage
	NFR               json.RawMessage
	Diagram           json.RawMessage
	APISpec           json.RawMessage
	DataModel         json.RawMessage
	Infrastructure    json.RawMessage
	WrapUp            *string
}
