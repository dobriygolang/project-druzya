package interviewapi

import (
	"encoding/json"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func sdPhaseToProto(p interviewmodel.SystemDesignPhase) interviewv1.SystemDesignPhase {
	switch p {
	case interviewmodel.SDPhaseBrief:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_BRIEF
	case interviewmodel.SDPhaseClarification:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_CLARIFICATION
	case interviewmodel.SDPhaseNFR:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_NFR
	case interviewmodel.SDPhaseDiagram:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_DIAGRAM
	case interviewmodel.SDPhaseAPI:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_API
	case interviewmodel.SDPhaseDataModel:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_DATA_MODEL
	case interviewmodel.SDPhaseDeepDive:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_DEEP_DIVE
	case interviewmodel.SDPhaseWrapUp:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_WRAP_UP
	case interviewmodel.SDPhaseSubmitted:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_SUBMITTED
	default:
		return interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_UNSPECIFIED
	}
}

func sdPhaseFromProto(p interviewv1.SystemDesignPhase) (interviewmodel.SystemDesignPhase, error) {
	switch p {
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_BRIEF:
		return interviewmodel.SDPhaseBrief, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_CLARIFICATION:
		return interviewmodel.SDPhaseClarification, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_NFR:
		return interviewmodel.SDPhaseNFR, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_DIAGRAM:
		return interviewmodel.SDPhaseDiagram, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_API:
		return interviewmodel.SDPhaseAPI, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_DATA_MODEL:
		return interviewmodel.SDPhaseDataModel, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_DEEP_DIVE:
		return interviewmodel.SDPhaseDeepDive, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_WRAP_UP:
		return interviewmodel.SDPhaseWrapUp, nil
	case interviewv1.SystemDesignPhase_SYSTEM_DESIGN_PHASE_SUBMITTED:
		return interviewmodel.SDPhaseSubmitted, nil
	default:
		return "", invalidArgument("invalid system design phase")
	}
}

func sdTurnRoleToProto(r interviewmodel.SystemDesignTurnRole) interviewv1.SystemDesignTurnRole {
	switch r {
	case interviewmodel.SDTurnRoleUser:
		return interviewv1.SystemDesignTurnRole_SYSTEM_DESIGN_TURN_ROLE_USER
	case interviewmodel.SDTurnRoleInterviewer:
		return interviewv1.SystemDesignTurnRole_SYSTEM_DESIGN_TURN_ROLE_INTERVIEWER
	case interviewmodel.SDTurnRoleSystem:
		return interviewv1.SystemDesignTurnRole_SYSTEM_DESIGN_TURN_ROLE_SYSTEM
	default:
		return interviewv1.SystemDesignTurnRole_SYSTEM_DESIGN_TURN_ROLE_UNSPECIFIED
	}
}

func toProtoSystemDesignWorkspace(ws *interviewmodel.SystemDesignWorkspace) (*interviewv1.SystemDesignWorkspace, error) {
	if ws == nil {
		return nil, nil
	}
	fc, err := rawJSONToStruct(ws.FunctionalContext)
	if err != nil {
		return nil, err
	}
	nfr, err := rawJSONToStruct(ws.NFR)
	if err != nil {
		return nil, err
	}
	diagram, err := rawJSONToStruct(ws.Diagram)
	if err != nil {
		return nil, err
	}
	apiSpec, err := rawJSONToStruct(ws.APISpec)
	if err != nil {
		return nil, err
	}
	dataModel, err := rawJSONToStruct(ws.DataModel)
	if err != nil {
		return nil, err
	}
	infra, err := rawJSONToStruct(ws.Infrastructure)
	if err != nil {
		return nil, err
	}
	out := &interviewv1.SystemDesignWorkspace{
		SessionTaskId:     ws.SessionTaskID,
		Phase:             sdPhaseToProto(ws.Phase),
		FunctionalContext: fc,
		Nfr:               nfr,
		Diagram:           diagram,
		ApiSpec:           apiSpec,
		DataModel:         dataModel,
		Infrastructure:    infra,
		Version:           int32(ws.Version),
		UpdatedAt:         timestamppb.New(ws.UpdatedAt),
	}
	if ws.WrapUp != nil {
		out.WrapUp = ws.WrapUp
	}
	return out, nil
}

func toProtoSystemDesignTurn(t *interviewmodel.SystemDesignTurn) (*interviewv1.SystemDesignTurn, error) {
	if t == nil {
		return nil, nil
	}
	meta, err := rawJSONToStruct(t.Metadata)
	if err != nil {
		return nil, err
	}
	return &interviewv1.SystemDesignTurn{
		Id:            t.ID,
		SessionTaskId: t.SessionTaskID,
		Phase:         sdPhaseToProto(t.Phase),
		Role:          sdTurnRoleToProto(t.Role),
		Content:       t.Content,
		Metadata:      meta,
		CreatedAt:     timestamppb.New(t.CreatedAt),
	}, nil
}

func structToRawJSON(s *structpb.Struct) json.RawMessage {
	if s == nil {
		return json.RawMessage("{}")
	}
	b, err := json.Marshal(s.AsMap())
	if err != nil {
		return json.RawMessage("{}")
	}
	return b
}

func optionalStructToRawJSON(s *structpb.Struct) json.RawMessage {
	if s == nil {
		return nil
	}
	return structToRawJSON(s)
}
