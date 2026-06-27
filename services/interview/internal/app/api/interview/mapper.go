package interviewapi

import (
	"encoding/json"
	"errors"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoSession(s *interviewmodel.Session) *interviewv1.Session {
	if s == nil {
		return nil
	}
	out := &interviewv1.Session{
		Id:           s.ID,
		UserId:       s.UserID,
		TemplateId:   s.TemplateID,
		Mode:         sessionModeToProto(s.Mode),
		Status:       sessionStatusToProto(s.Status),
		StartedAt:    timestamppb.New(s.StartedAt),
		PassingScore: int32(s.PassingScore),
		CreatedAt:    timestamppb.New(s.CreatedAt),
		UpdatedAt:    timestamppb.New(s.UpdatedAt),
	}
	if s.CompletedAt != nil {
		out.CompletedAt = timestamppb.New(*s.CompletedAt)
	}
	if s.TotalScore != nil {
		score := s.TotalScore.String()
		out.TotalScore = &score
	}
	return out
}

func toProtoSessionSection(s *interviewmodel.SessionSection) *interviewv1.SessionSection {
	if s == nil {
		return nil
	}
	out := &interviewv1.SessionSection{
		Id:          s.ID,
		SessionId:   s.SessionID,
		SectionType: s.SectionType,
		Title:       s.Title,
		Position:    int32(s.Position),
		Status:      sectionStatusToProto(s.Status),
		CreatedAt:   timestamppb.New(s.CreatedAt),
		UpdatedAt:   timestamppb.New(s.UpdatedAt),
	}
	if s.PassingScore != nil {
		val := int32(*s.PassingScore)
		out.PassingScore = &val
	}
	if s.Score != nil {
		score := s.Score.String()
		out.Score = &score
	}
	return out
}

func toProtoSessionTask(t *interviewmodel.SessionTask) *interviewv1.SessionTask {
	if t == nil {
		return nil
	}
	return &interviewv1.SessionTask{
		Id:        t.ID,
		SessionId: t.SessionID,
		SectionId: t.SectionID,
		TaskId:    t.TaskID,
		Position:  int32(t.Position),
		Status:    sessionTaskStatusToProto(t.Status),
		CreatedAt: timestamppb.New(t.CreatedAt),
		UpdatedAt: timestamppb.New(t.UpdatedAt),
	}
}

func toProtoAttempt(a *interviewmodel.Attempt) (*interviewv1.Attempt, error) {
	if a == nil {
		return nil, nil
	}
	attachments, err := rawJSONToStruct(a.Attachments)
	if err != nil {
		return nil, err
	}
	return &interviewv1.Attempt{
		Id:            a.ID,
		UserId:        a.UserID,
		SessionTaskId: a.SessionTaskID,
		TaskId:        a.TaskID,
		AnswerText:    a.AnswerText,
		Code:          a.Code,
		Language:      a.Language,
		Attachments:   attachments,
		Status:        attemptStatusToProto(a.Status),
		SubmittedAt:   timestamppb.New(a.SubmittedAt),
		CreatedAt:     timestamppb.New(a.CreatedAt),
		UpdatedAt:     timestamppb.New(a.UpdatedAt),
	}, nil
}

func toProtoEvaluationSummary(e *interviewmodel.EvaluationSummary) (*interviewv1.EvaluationSummary, error) {
	if e == nil {
		return nil, nil
	}
	feedback, err := rawJSONToStruct(e.Feedback)
	if err != nil {
		return nil, err
	}
	return &interviewv1.EvaluationSummary{
		Id:        e.ID,
		AttemptId: e.AttemptID,
		Score:     e.Score.String(),
		Passed:    e.Passed,
		Summary:   e.Summary,
		Feedback:  feedback,
		CreatedAt: timestamppb.New(e.CreatedAt),
		UpdatedAt: timestamppb.New(e.UpdatedAt),
	}, nil
}

func toProtoRetryItem(item *interviewmodel.RetryItem) *interviewv1.RetryItem {
	if item == nil {
		return nil
	}
	out := &interviewv1.RetryItem{
		Id:              item.ID,
		UserId:          item.UserID,
		TaskId:          item.TaskID,
		SourceAttemptId: item.SourceAttemptID,
		SessionId:       item.SessionID,
		Reason:          item.Reason,
		Status:          retryItemStatusToProto(item.Status),
		CreatedAt:       timestamppb.New(item.CreatedAt),
		UpdatedAt:       timestamppb.New(item.UpdatedAt),
	}
	if item.NextRetryAt != nil {
		out.NextRetryAt = timestamppb.New(*item.NextRetryAt)
	}
	if item.ResolvedAt != nil {
		out.ResolvedAt = timestamppb.New(*item.ResolvedAt)
	}
	return out
}

func toProtoProgress(p interviewmodel.Progress) *interviewv1.Progress {
	return &interviewv1.Progress{
		TotalTasks:     int32(p.TotalTasks),
		EvaluatedTasks: int32(p.EvaluatedTasks),
		SkippedTasks:   int32(p.SkippedTasks),
		TotalSections:  int32(p.TotalSections),
		DoneSections:   int32(p.DoneSections),
	}
}

func toProtoSessionSections(sections []interviewmodel.SessionSection) []*interviewv1.SessionSection {
	out := make([]*interviewv1.SessionSection, 0, len(sections))
	for i := range sections {
		out = append(out, toProtoSessionSection(&sections[i]))
	}
	return out
}

func toProtoSessionTasks(tasks []interviewmodel.SessionTask) []*interviewv1.SessionTask {
	out := make([]*interviewv1.SessionTask, 0, len(tasks))
	for i := range tasks {
		out = append(out, toProtoSessionTask(&tasks[i]))
	}
	return out
}

func toProtoSessionDetail(d *interviewmodel.SessionDetail) (*interviewv1.Session, []*interviewv1.SessionSection, []*interviewv1.SessionTask, *interviewv1.Progress) {
	if d == nil {
		return nil, nil, nil, nil
	}
	return toProtoSession(d.Session), toProtoSessionSections(d.Sections), toProtoSessionTasks(d.Tasks), toProtoProgress(d.Progress)
}

func toProtoSessionResults(r *interviewmodel.SessionResults) (*interviewv1.Session, []*interviewv1.SessionSection, []*interviewv1.SessionTask, []*interviewv1.EvaluationResult, *interviewv1.Progress, error) {
	if r == nil {
		return nil, nil, nil, nil, nil, nil
	}

	evaluations := make([]*interviewv1.EvaluationResult, 0, len(r.Evaluations))
	for i := range r.Evaluations {
		summary, err := toProtoEvaluationSummary(r.Evaluations[i].Summary)
		if err != nil {
			return nil, nil, nil, nil, nil, err
		}
		attempt, err := toProtoAttempt(r.Evaluations[i].Attempt)
		if err != nil {
			return nil, nil, nil, nil, nil, err
		}
		evaluations = append(evaluations, &interviewv1.EvaluationResult{
			Summary: summary,
			Attempt: attempt,
			TaskId:  r.Evaluations[i].TaskID,
		})
	}

	return toProtoSession(r.Session), toProtoSessionSections(r.Sections), toProtoSessionTasks(r.Tasks), evaluations, toProtoProgress(r.Progress), nil
}

func attachmentsFromProto(items []*interviewv1.Attachment) []interviewmodel.Attachment {
	if len(items) == 0 {
		return nil
	}
	out := make([]interviewmodel.Attachment, 0, len(items))
	for _, item := range items {
		if item == nil {
			continue
		}
		out = append(out, interviewmodel.Attachment{
			Name: item.GetName(),
			URL:  item.GetUrl(),
			Type: item.GetType(),
		})
	}
	return out
}

func parseRetryItemStatusFilter(status *interviewv1.RetryItemStatus) (*interviewmodel.RetryItemStatus, error) {
	if status == nil {
		return nil, nil
	}
	return retryItemStatusFromProto(*status)
}

func structToMap(s *structpb.Struct) map[string]any {
	if s == nil {
		return map[string]any{}
	}
	return s.AsMap()
}

func rawJSONToStruct(raw json.RawMessage) (*structpb.Struct, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return structpb.NewStruct(map[string]any{})
	}

	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err == nil {
		return structpb.NewStruct(obj)
	}

	var arr []any
	if err := json.Unmarshal(raw, &arr); err == nil {
		return structpb.NewStruct(map[string]any{"items": arr})
	}

	return structpb.NewStruct(map[string]any{})
}

func optionalString(v *string) *string {
	if v == nil || *v == "" {
		return nil
	}
	return v
}

func mapServiceError(err error) error {
	if interviewservice.IsNotFound(err) {
		return notFound("not found")
	}
	if interviewservice.IsForbidden(err) {
		return permissionDenied("forbidden")
	}
	if interviewservice.IsInvalidInput(err) {
		return invalidArgument("invalid request")
	}
	if errors.Is(err, interviewservice.ErrConflict) {
		return failedPrecondition("conflict")
	}
	if errors.Is(err, interviewservice.ErrActiveSessionExists) {
		return failedPrecondition("active session already exists")
	}
	if errors.Is(err, interviewservice.ErrRetryItemsUnavailable) {
		return failedPrecondition("retry items unavailable")
	}
	if errors.Is(err, interviewservice.ErrSessionClosed) {
		return failedPrecondition("session closed")
	}
	if errors.Is(err, interviewservice.ErrQuotaExceeded) {
		return failedPrecondition("quota exceeded")
	}
	if errors.Is(err, interviewservice.ErrFeatureDisabled) {
		return failedPrecondition("feature not available on current plan")
	}
	return status.Error(codes.Internal, "internal error")
}
