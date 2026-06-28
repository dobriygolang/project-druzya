package interviewapi

import (
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

func practiceScopeFromProto(scope interviewv1.PracticeScope) (interviewmodel.PracticeScope, error) {
	switch scope {
	case interviewv1.PracticeScope_PRACTICE_SCOPE_UNSPECIFIED,
		interviewv1.PracticeScope_PRACTICE_SCOPE_RANDOM_ONE:
		return interviewmodel.PracticeScopeRandomOne, nil
	case interviewv1.PracticeScope_PRACTICE_SCOPE_COMPANY_TRACK:
		return interviewmodel.PracticeScopeCompanyTrack, nil
	case interviewv1.PracticeScope_PRACTICE_SCOPE_REVIEW:
		return interviewmodel.PracticeScopeReview, nil
	default:
		return "", invalidArgument("invalid practice scope")
	}
}

func sessionModeToProto(mode interviewmodel.SessionMode) interviewv1.SessionMode {
	switch mode {
	case interviewmodel.ModeCompanyInterview:
		return interviewv1.SessionMode_SESSION_MODE_COMPANY_INTERVIEW
	case interviewmodel.ModeAlgorithmsTraining:
		return interviewv1.SessionMode_SESSION_MODE_ALGORITHMS_TRAINING
	case interviewmodel.ModeLiveCodingTraining:
		return interviewv1.SessionMode_SESSION_MODE_LIVE_CODING_TRAINING
	case interviewmodel.ModeSystemDesignTraining:
		return interviewv1.SessionMode_SESSION_MODE_SYSTEM_DESIGN_TRAINING
	case interviewmodel.ModeBehavioralTraining:
		return interviewv1.SessionMode_SESSION_MODE_BEHAVIORAL_TRAINING
	case interviewmodel.ModeSQLTraining:
		return interviewv1.SessionMode_SESSION_MODE_SQL_TRAINING
	case interviewmodel.ModeRetryMistakes:
		return interviewv1.SessionMode_SESSION_MODE_RETRY_MISTAKES
	default:
		return interviewv1.SessionMode_SESSION_MODE_UNSPECIFIED
	}
}

func sessionModeFromProto(mode interviewv1.SessionMode) (interviewmodel.SessionMode, error) {
	switch mode {
	case interviewv1.SessionMode_SESSION_MODE_COMPANY_INTERVIEW:
		return interviewmodel.ModeCompanyInterview, nil
	case interviewv1.SessionMode_SESSION_MODE_ALGORITHMS_TRAINING:
		return interviewmodel.ModeAlgorithmsTraining, nil
	case interviewv1.SessionMode_SESSION_MODE_LIVE_CODING_TRAINING:
		return interviewmodel.ModeLiveCodingTraining, nil
	case interviewv1.SessionMode_SESSION_MODE_SYSTEM_DESIGN_TRAINING:
		return interviewmodel.ModeSystemDesignTraining, nil
	case interviewv1.SessionMode_SESSION_MODE_BEHAVIORAL_TRAINING:
		return interviewmodel.ModeBehavioralTraining, nil
	case interviewv1.SessionMode_SESSION_MODE_SQL_TRAINING:
		return interviewmodel.ModeSQLTraining, nil
	case interviewv1.SessionMode_SESSION_MODE_UNSPECIFIED:
		return "", invalidArgument("mode is required")
	default:
		return "", invalidArgument("invalid session mode")
	}
}

func sessionStatusToProto(status interviewmodel.SessionStatus) interviewv1.SessionStatus {
	switch status {
	case interviewmodel.SessionStatusActive:
		return interviewv1.SessionStatus_SESSION_STATUS_ACTIVE
	case interviewmodel.SessionStatusCompleted:
		return interviewv1.SessionStatus_SESSION_STATUS_COMPLETED
	case interviewmodel.SessionStatusCancelled:
		return interviewv1.SessionStatus_SESSION_STATUS_CANCELLED
	case interviewmodel.SessionStatusExpired:
		return interviewv1.SessionStatus_SESSION_STATUS_EXPIRED
	case interviewmodel.SessionStatusPaused:
		return interviewv1.SessionStatus_SESSION_STATUS_PAUSED
	default:
		return interviewv1.SessionStatus_SESSION_STATUS_UNSPECIFIED
	}
}

func sectionStatusToProto(status interviewmodel.SectionStatus) interviewv1.SectionStatus {
	switch status {
	case interviewmodel.SectionStatusPending:
		return interviewv1.SectionStatus_SECTION_STATUS_PENDING
	case interviewmodel.SectionStatusActive:
		return interviewv1.SectionStatus_SECTION_STATUS_ACTIVE
	case interviewmodel.SectionStatusCompleted:
		return interviewv1.SectionStatus_SECTION_STATUS_COMPLETED
	default:
		return interviewv1.SectionStatus_SECTION_STATUS_UNSPECIFIED
	}
}

func sessionTaskStatusToProto(status interviewmodel.SessionTaskStatus) interviewv1.SessionTaskStatus {
	switch status {
	case interviewmodel.SessionTaskAssigned:
		return interviewv1.SessionTaskStatus_SESSION_TASK_STATUS_ASSIGNED
	case interviewmodel.SessionTaskSubmitted:
		return interviewv1.SessionTaskStatus_SESSION_TASK_STATUS_SUBMITTED
	case interviewmodel.SessionTaskEvaluated:
		return interviewv1.SessionTaskStatus_SESSION_TASK_STATUS_EVALUATED
	case interviewmodel.SessionTaskSkipped:
		return interviewv1.SessionTaskStatus_SESSION_TASK_STATUS_SKIPPED
	default:
		return interviewv1.SessionTaskStatus_SESSION_TASK_STATUS_UNSPECIFIED
	}
}

func attemptStatusToProto(status interviewmodel.AttemptStatus) interviewv1.AttemptStatus {
	switch status {
	case interviewmodel.AttemptStatusSubmitted:
		return interviewv1.AttemptStatus_ATTEMPT_STATUS_SUBMITTED
	case interviewmodel.AttemptStatusEvaluating:
		return interviewv1.AttemptStatus_ATTEMPT_STATUS_EVALUATING
	case interviewmodel.AttemptStatusEvaluated:
		return interviewv1.AttemptStatus_ATTEMPT_STATUS_EVALUATED
	case interviewmodel.AttemptStatusFailed:
		return interviewv1.AttemptStatus_ATTEMPT_STATUS_FAILED
	case interviewmodel.AttemptStatusCancelled:
		return interviewv1.AttemptStatus_ATTEMPT_STATUS_CANCELLED
	default:
		return interviewv1.AttemptStatus_ATTEMPT_STATUS_UNSPECIFIED
	}
}

func retryItemStatusToProto(status interviewmodel.RetryItemStatus) interviewv1.RetryItemStatus {
	switch status {
	case interviewmodel.RetryStatusPending:
		return interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_PENDING
	case interviewmodel.RetryStatusInProgress:
		return interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_IN_PROGRESS
	case interviewmodel.RetryStatusCompleted:
		return interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_COMPLETED
	case interviewmodel.RetryStatusDismissed:
		return interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_DISMISSED
	default:
		return interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_UNSPECIFIED
	}
}

func sessionOutcomeToProto(outcome *interviewmodel.SessionOutcome) *interviewv1.SessionOutcome {
	if outcome == nil {
		return nil
	}
	switch *outcome {
	case interviewmodel.SessionOutcomePassed:
		val := interviewv1.SessionOutcome_SESSION_OUTCOME_PASSED
		return &val
	case interviewmodel.SessionOutcomeFailed:
		val := interviewv1.SessionOutcome_SESSION_OUTCOME_FAILED
		return &val
	default:
		return nil
	}
}

func retryItemStatusFromProto(status interviewv1.RetryItemStatus) (*interviewmodel.RetryItemStatus, error) {
	switch status {
	case interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_UNSPECIFIED:
		return nil, nil
	case interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_PENDING:
		st := interviewmodel.RetryStatusPending
		return &st, nil
	case interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_IN_PROGRESS:
		st := interviewmodel.RetryStatusInProgress
		return &st, nil
	case interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_COMPLETED:
		st := interviewmodel.RetryStatusCompleted
		return &st, nil
	case interviewv1.RetryItemStatus_RETRY_ITEM_STATUS_DISMISSED:
		st := interviewmodel.RetryStatusDismissed
		return &st, nil
	default:
		return nil, invalidArgument("invalid retry item status")
	}
}
