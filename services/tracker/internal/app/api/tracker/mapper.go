package trackerapi

import (
	trackerv1 "github.com/sedorofeevd/project-druzya/services/tracker/pkg/api/tracker/v1"
	"github.com/sedorofeevd/project-druzya/services/tracker/internal/tracker/model"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func projectToProto(p *model.Project) *trackerv1.Project {
	if p == nil {
		return nil
	}
	return &trackerv1.Project{Id: p.ID, Name: p.Name, Position: int32(p.Position)}
}

func epicToProto(e *model.Epic) *trackerv1.Epic {
	if e == nil {
		return nil
	}
	return &trackerv1.Epic{Id: e.ID, ProjectId: e.ProjectID, Name: e.Name, Position: int32(e.Position)}
}

func sprintToProto(s *model.Sprint) *trackerv1.Sprint {
	if s == nil {
		return nil
	}
	return &trackerv1.Sprint{
		Id: s.ID, ProjectId: s.ProjectID, Name: s.Name, Goal: s.Goal,
		Status: sprintStatusToProto(s.Status), Position: int32(s.Position),
		DoneCount: int32(s.DoneCount), TotalCount: int32(s.TotalCount),
	}
}

func sprintStatusToProto(s model.SprintStatus) trackerv1.SprintStatus {
	switch s {
	case model.SprintStatusActive:
		return trackerv1.SprintStatus_SPRINT_STATUS_ACTIVE
	case model.SprintStatusArchived:
		return trackerv1.SprintStatus_SPRINT_STATUS_ARCHIVED
	default:
		return trackerv1.SprintStatus_SPRINT_STATUS_UNSPECIFIED
	}
}

func taskToProto(t *model.Task) *trackerv1.Task {
	if t == nil {
		return nil
	}
	out := &trackerv1.Task{
		Id: t.ID, SprintId: t.SprintID, Title: t.Title, Done: t.Done,
		Position: int32(t.Position), Source: taskSourceToProto(t.Source),
		CreatedAt: timestamppb.New(t.CreatedAt), UpdatedAt: timestamppb.New(t.UpdatedAt),
	}
	if t.EpicID != nil {
		out.EpicId = t.EpicID
	}
	if t.CompletedAt != nil {
		out.CompletedAt = timestamppb.New(*t.CompletedAt)
	}
	if t.Metadata != nil {
		if st, err := structpb.NewStruct(t.Metadata); err == nil {
			out.Metadata = st
		}
	}
	return out
}

func taskSourceToProto(s model.TaskSource) trackerv1.TaskSource {
	switch s {
	case model.TaskSourceUser:
		return trackerv1.TaskSource_TASK_SOURCE_USER
	case model.TaskSourceRecommendation:
		return trackerv1.TaskSource_TASK_SOURCE_RECOMMENDATION
	case model.TaskSourceEnrichment:
		return trackerv1.TaskSource_TASK_SOURCE_ENRICHMENT
	default:
		return trackerv1.TaskSource_TASK_SOURCE_UNSPECIFIED
	}
}

func taskSourceFromProto(s trackerv1.TaskSource) model.TaskSource {
	switch s {
	case trackerv1.TaskSource_TASK_SOURCE_USER:
		return model.TaskSourceUser
	case trackerv1.TaskSource_TASK_SOURCE_RECOMMENDATION:
		return model.TaskSourceRecommendation
	case trackerv1.TaskSource_TASK_SOURCE_ENRICHMENT:
		return model.TaskSourceEnrichment
	default:
		return model.TaskSourceUser
	}
}

func boardToProto(b *model.Board) *trackerv1.Board {
	if b == nil {
		return &trackerv1.Board{}
	}
	out := &trackerv1.Board{Project: projectToProto(b.Project)}
	for _, e := range b.Epics {
		out.Epics = append(out.Epics, epicToProto(&e))
	}
	out.ActiveSprint = sprintToProto(b.ActiveSprint)
	for _, t := range b.Tasks {
		out.Tasks = append(out.Tasks, taskToProto(&t))
	}
	for _, s := range b.ArchivedSprints {
		out.ArchivedSprints = append(out.ArchivedSprints, sprintToProto(&s))
	}
	return out
}

func metadataFromProto(st *structpb.Struct) map[string]any {
	if st == nil {
		return map[string]any{}
	}
	return st.AsMap()
}

func userSettingsToProto(s *model.UserSettingsView) *trackerv1.UserSettings {
	if s == nil {
		return &trackerv1.UserSettings{}
	}
	return &trackerv1.UserSettings{
		SmartParseEnabled:         s.SmartParseEnabled,
		GoogleCalendarSyncEnabled: s.GoogleCalendarSyncEnabled,
		GoogleCalendarConnected:   s.GoogleCalendarConnected,
	}
}
