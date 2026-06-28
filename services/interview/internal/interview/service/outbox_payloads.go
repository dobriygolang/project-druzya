package service

import (
	"time"

	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func outboxTaskSkippedPayload(sessionTaskID, sessionID, taskID, userID, mode string, occurredAt time.Time) map[string]any {
	return map[string]any{
		"session_task_id": sessionTaskID,
		"session_id":      sessionID,
		"task_id":         taskID,
		"user_id":         userID,
		"mode":            mode,
		"occurred_at":     occurredAt.Format(time.RFC3339Nano),
	}
}

func outboxSessionCompletedPayload(session *interviewmodel.Session, occurredAt time.Time) map[string]any {
	payload := map[string]any{
		"session_id":    session.ID,
		"user_id":       session.UserID,
		"mode":          string(session.Mode),
		"passing_score": session.PassingScore,
		"occurred_at":   occurredAt.Format(time.RFC3339Nano),
	}
	if session.TemplateID != nil && *session.TemplateID != "" {
		payload["template_id"] = *session.TemplateID
	}
	if session.TotalScore != nil {
		payload["total_score"] = session.TotalScore.String()
	}
	if session.Outcome != nil {
		payload["outcome"] = string(*session.Outcome)
	}
	return payload
}
