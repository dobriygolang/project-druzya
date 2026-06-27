package model

import "fmt"

// SessionMode defines how the interview session was started.
type SessionMode string

const (
	ModeCompanyInterview      SessionMode = "company_interview"
	ModeAlgorithmsTraining    SessionMode = "algorithms_training"
	ModeLiveCodingTraining    SessionMode = "live_coding_training"
	ModeSystemDesignTraining  SessionMode = "system_design_training"
	ModeBehavioralTraining    SessionMode = "behavioral_training"
	ModeSQLTraining           SessionMode = "sql_training"
	ModeRetryMistakes         SessionMode = "retry_mistakes"
)

// TaskTypeForMode maps training modes to content task types.
var TaskTypeForMode = map[SessionMode]string{
	ModeAlgorithmsTraining:   "algorithm",
	ModeLiveCodingTraining:   "live_coding",
	ModeSystemDesignTraining: "system_design",
	ModeBehavioralTraining:   "behavioral",
	ModeSQLTraining:          "sql",
}

// SessionStatus is runtime state of an interview session.
type SessionStatus string

const (
	SessionStatusActive    SessionStatus = "active"
	SessionStatusCompleted SessionStatus = "completed"
	SessionStatusCancelled SessionStatus = "cancelled"
	SessionStatusExpired   SessionStatus = "expired"
)

// SectionStatus is runtime state of a session section.
type SectionStatus string

const (
	SectionStatusPending   SectionStatus = "pending"
	SectionStatusActive    SectionStatus = "active"
	SectionStatusCompleted SectionStatus = "completed"
)

// SessionTaskStatus is assignment state of a task within a session.
type SessionTaskStatus string

const (
	SessionTaskAssigned  SessionTaskStatus = "assigned"
	SessionTaskSubmitted SessionTaskStatus = "submitted"
	SessionTaskEvaluated SessionTaskStatus = "evaluated"
	SessionTaskSkipped   SessionTaskStatus = "skipped"
)

// AttemptStatus is lifecycle state of a user attempt.
type AttemptStatus string

const (
	AttemptStatusSubmitted  AttemptStatus = "submitted"
	AttemptStatusEvaluating AttemptStatus = "evaluating"
	AttemptStatusEvaluated  AttemptStatus = "evaluated"
	AttemptStatusFailed     AttemptStatus = "failed"
	AttemptStatusCancelled  AttemptStatus = "cancelled"
)

// RetryItemStatus is queue state for mistake retries.
type RetryItemStatus string

const (
	RetryStatusPending    RetryItemStatus = "pending"
	RetryStatusInProgress RetryItemStatus = "in_progress"
	RetryStatusCompleted  RetryItemStatus = "completed"
	RetryStatusDismissed  RetryItemStatus = "dismissed"
)

// ParseSessionMode validates a session mode string.
func ParseSessionMode(mode string) (SessionMode, error) {
	m := SessionMode(mode)
	switch m {
	case ModeCompanyInterview,
		ModeAlgorithmsTraining,
		ModeLiveCodingTraining,
		ModeSystemDesignTraining,
		ModeBehavioralTraining,
		ModeSQLTraining:
		return m, nil
	default:
		return "", fmt.Errorf("invalid session mode %q", mode)
	}
}
