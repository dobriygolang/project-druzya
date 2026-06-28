package interviewapi

import (
	"context"

	interviewservice "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/service"
	interviewv1 "github.com/sedorofeevd/project-druzya/services/interview/pkg/api/interview/v1"
)

// StartInterviewSession starts a new interview session for the authenticated user.
func (i *Implementation) StartInterviewSession(
	ctx context.Context,
	req *interviewv1.StartInterviewSessionRequest,
) (*interviewv1.StartInterviewSessionResponse, error) {
	userID, err := requireUserID(ctx)
	if err != nil {
		return nil, err
	}

	mode, err := sessionModeFromProto(req.GetMode())
	if err != nil {
		return nil, err
	}
	scope, err := practiceScopeFromProto(req.GetPracticeScope())
	if err != nil {
		return nil, err
	}

	detail, err := i.service.StartInterviewSession(
		ctx,
		userID,
		interviewservice.StartSessionInput{
			TemplateID: optionalString(req.TemplateId),
			Mode:       mode,
			CompanyID:  optionalString(req.CompanyId),
			Scope:      scope,
		},
	)
	if err != nil {
		return nil, mapServiceError(err)
	}

	session, sections, tasks, progress := toProtoSessionDetail(detail)
	return &interviewv1.StartInterviewSessionResponse{
		Session:  session,
		Sections: sections,
		Tasks:    tasks,
		Progress: progress,
	}, nil
}
