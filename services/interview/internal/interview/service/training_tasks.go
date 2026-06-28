package service

import (
	"context"
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func normalizePracticeScope(scope interviewmodel.PracticeScope) interviewmodel.PracticeScope {
	if scope == "" || scope == interviewmodel.PracticeScopeRandomOne {
		return interviewmodel.PracticeScopeRandomOne
	}
	return scope
}

func (s *interviewService) resolveTrainingTasks(
	ctx context.Context,
	mode interviewmodel.SessionMode,
	scope interviewmodel.PracticeScope,
	companyID *string,
) ([]contentadapter.Task, error) {
	taskType, ok := interviewmodel.TaskTypeForMode[mode]
	if !ok {
		return nil, fmt.Errorf("unsupported training mode: %w", ErrInvalidInput)
	}
	scope = normalizePracticeScope(scope)

	switch scope {
	case interviewmodel.PracticeScopeCompanyTrack:
		if companyID == nil || *companyID == "" {
			return nil, fmt.Errorf("company_id required for company track: %w", ErrInvalidInput)
		}
		return s.trainingTasksFromCompany(ctx, *companyID, taskType)
	default:
		return s.trainingTasksRandomOne(ctx, taskType)
	}
}

func (s *interviewService) trainingTasksRandomOne(ctx context.Context, taskType string) ([]contentadapter.Task, error) {
	catalogTasks, err := s.content.ListTasks(ctx, taskType, s.trainingLimit)
	if err != nil {
		return nil, mapContentError(err)
	}
	if len(catalogTasks) == 0 {
		return nil, fmt.Errorf("no tasks available: %w", ErrNotFound)
	}
	shuffleTasks(catalogTasks)
	return catalogTasks[:1], nil
}

func (s *interviewService) trainingTasksFromCompany(ctx context.Context, companyID, taskType string) ([]contentadapter.Task, error) {
	templates, err := s.content.ListInterviewTemplates(ctx, companyID, true, 10)
	if err != nil {
		return nil, mapContentError(err)
	}
	if len(templates) == 0 {
		return nil, fmt.Errorf("no interview templates for company: %w", ErrNotFound)
	}

	seen := make(map[string]struct{})
	var matched []contentadapter.Task
	for _, tmpl := range templates {
		detail, err := s.content.GetInterviewTemplateDetail(ctx, tmpl.ID)
		if err != nil {
			return nil, mapContentError(err)
		}
		for _, sec := range detail.Sections {
			if !sectionMatchesTaskType(sec.SectionType, taskType) {
				continue
			}
			for _, taskID := range sec.TaskIDs {
				if _, ok := seen[taskID]; ok {
					continue
				}
				task, err := s.content.GetTask(ctx, taskID)
				if err != nil {
					return nil, mapContentError(err)
				}
				if task.Type != taskType {
					continue
				}
				seen[taskID] = struct{}{}
				matched = append(matched, *task)
			}
		}
	}
	if len(matched) == 0 {
		return nil, fmt.Errorf("no %s tasks for company track: %w", taskType, ErrNotFound)
	}
	shuffleTasks(matched)
	return matched, nil
}

func sectionMatchesTaskType(sectionType, taskType string) bool {
	if sectionType == taskType {
		return true
	}
	// Legacy templates may still label live-coding sections as "algorithm".
	if taskType == "live_coding" && sectionType == "algorithm" {
		return true
	}
	return false
}
