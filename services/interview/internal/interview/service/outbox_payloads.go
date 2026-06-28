package service

import (
	"time"

	"github.com/shopspring/decimal"
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

func outboxSessionCompletedPayload(sessionID, userID, mode string, totalScore *decimal.Decimal, occurredAt time.Time) map[string]any {
	payload := map[string]any{
		"session_id":  sessionID,
		"user_id":     userID,
		"mode":        mode,
		"occurred_at": occurredAt.Format(time.RFC3339Nano),
	}
	if totalScore != nil {
		payload["total_score"] = totalScore.String()
	}
	return payload
}
