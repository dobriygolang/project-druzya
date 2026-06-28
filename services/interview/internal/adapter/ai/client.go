package ai

import (
	"context"
	"encoding/json"
)

// TurnMessage is one chat line for the SD interviewer.
type TurnMessage struct {
	Role    string
	Content string
	Phase   string
}

// InterviewerTurnInput drives a multi-turn SD mock reply.
type InterviewerTurnInput struct {
	UserID             string
	TaskID             string
	Phase              string
	Turns              []TurnMessage
	WorkspaceSnapshot  map[string]any
	TaskTitle          string
	TaskDescription    string
}

// InterviewerTurnOutput is the AI interviewer reply.
type InterviewerTurnOutput struct {
	Reply          string
	SuggestedPhase *string
	Metadata       map[string]any
}

// CheckpointInput requests phase critique (optional diagram PNG).
type CheckpointInput struct {
	UserID            string
	TaskID            string
	Phase             string
	WorkspaceSnapshot map[string]any
	DiagramPNGBase64  *string
	TaskTitle         string
	TaskDescription   string
}

// CheckpointOutput is structured critique text.
type CheckpointOutput struct {
	Critique string
	Metadata map[string]any
}

// Client calls ai-service internal RPCs for SD room features.
//
//go:generate go run github.com/vektra/mockery/v2@v2.53.5 --case=underscore --with-expecter --name=Client --output=./mocks --outpkg=mocks --filename=client.go
type Client interface {
	RunSystemDesignInterviewerTurn(ctx context.Context, in InterviewerTurnInput) (*InterviewerTurnOutput, error)
	RunSystemDesignCheckpoint(ctx context.Context, in CheckpointInput) (*CheckpointOutput, error)
}

// WorkspaceSnapshotFromJSON builds a map from workspace JSON fields.
func WorkspaceSnapshotFromJSON(
	phase string,
	functionalContext, nfr, diagram, apiSpec, dataModel, infrastructure json.RawMessage,
	wrapUp *string,
) map[string]any {
	out := map[string]any{"phase": phase}
	out["functional_context"] = rawToMap(functionalContext)
	out["nfr"] = rawToMap(nfr)
	out["diagram"] = rawToMap(diagram)
	out["api_spec"] = rawToMap(apiSpec)
	out["data_model"] = rawToMap(dataModel)
	out["infrastructure"] = rawToMap(infrastructure)
	if wrapUp != nil {
		out["wrap_up"] = *wrapUp
	}
	return out
}

func rawToMap(raw json.RawMessage) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		return map[string]any{}
	}
	return m
}
