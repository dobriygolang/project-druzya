package aiapi

import (
	evaluationmodel "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/model"
	evaluationservice "github.com/sedorofeevd/project-druzya/services/ai/internal/evaluation/service"
	aiv1 "github.com/sedorofeevd/project-druzya/services/ai/pkg/api/ai/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func toProtoJob(job *evaluationmodel.EvaluationJob) *aiv1.EvaluationJob {
	if job == nil {
		return nil
	}
	out := &aiv1.EvaluationJob{
		Id:         job.ID,
		AttemptId:  job.AttemptID,
		UserId:     job.UserID,
		TaskId:     job.TaskID,
		Status:     jobStatusToProto(job.Status),
		RetryCount: int32(job.RetryCount),
		Retryable:  job.Retryable,
		Error:      job.Error,
		CreatedAt:  timestamppb.New(job.CreatedAt),
		UpdatedAt:  timestamppb.New(job.UpdatedAt),
	}
	if job.NextRetryAt != nil {
		out.NextRetryAt = timestamppb.New(*job.NextRetryAt)
	}
	if job.StartedAt != nil {
		out.StartedAt = timestamppb.New(*job.StartedAt)
	}
	if job.CompletedAt != nil {
		out.CompletedAt = timestamppb.New(*job.CompletedAt)
	}
	return out
}

func jobStatusToProto(status evaluationmodel.JobStatus) aiv1.EvaluationJobStatus {
	switch status {
	case evaluationmodel.JobStatusPending:
		return aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_PENDING
	case evaluationmodel.JobStatusRunning:
		return aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_RUNNING
	case evaluationmodel.JobStatusCompleted:
		return aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_COMPLETED
	case evaluationmodel.JobStatusFailed:
		return aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_FAILED
	default:
		return aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_UNSPECIFIED
	}
}

func jobStatusFromProto(status aiv1.EvaluationJobStatus) *evaluationmodel.JobStatus {
	switch status {
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_PENDING:
		s := evaluationmodel.JobStatusPending
		return &s
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_RUNNING:
		s := evaluationmodel.JobStatusRunning
		return &s
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_COMPLETED:
		s := evaluationmodel.JobStatusCompleted
		return &s
	case aiv1.EvaluationJobStatus_EVALUATION_JOB_STATUS_FAILED:
		s := evaluationmodel.JobStatusFailed
		return &s
	default:
		return nil
	}
}

func mapServiceError(err error) error {
	switch {
	case evaluationservice.IsNotFound(err):
		return notFound("not found")
	case evaluationservice.IsInvalidInput(err):
		return invalidArgument(err.Error())
	case evaluationservice.IsQuotaExceeded(err):
		return status.Error(codes.ResourceExhausted, "quota exceeded")
	default:
		return status.Error(codes.Internal, "internal error")
	}
}
