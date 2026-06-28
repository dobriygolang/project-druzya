package service

import (
	"context"
	"fmt"

	contentadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/content"
	recommendationadapter "github.com/sedorofeevd/project-druzya/services/interview/internal/adapter/recommendation"
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
	userID string,
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
		return s.trainingTasksFromCompany(ctx, userID, *companyID, taskType, scope)
	default:
		return s.trainingTasksRandomOne(ctx, userID, taskType, scope)
	}
}

func (s *interviewService) trainingTasksRandomOne(
	ctx context.Context,
	userID, taskType string,
	scope interviewmodel.PracticeScope,
) ([]contentadapter.Task, error) {
	catalogTasks, err := s.content.ListTasks(ctx, taskType, s.trainingLimit)
	if err != nil {
		return nil, mapContentError(err)
	}
	if len(catalogTasks) == 0 {
		return nil, fmt.Errorf("no tasks available: %w", ErrNotFound)
	}

	passedIDs, reviewCandidates, pendingRetryIDs := s.loadTaskPickerHints(ctx, userID, taskType)

	if scope == interviewmodel.PracticeScopeReview {
		reviewPool := filterTasksByIDs(catalogTasks, reviewCandidateTaskIDs(reviewCandidates))
		if len(reviewPool) > 0 {
			return pickTasks(reviewPool, 1), nil
		}
	}

	fresh := filterTasksExcludingIDs(catalogTasks, unionTaskIDs(passedIDs, pendingRetryIDs))
	if len(fresh) == 0 {
		fresh = catalogTasks
	}
	return pickTasks(fresh, 1), nil
}

func (s *interviewService) trainingTasksFromCompany(
	ctx context.Context,
	userID, companyID, taskType string,
	scope interviewmodel.PracticeScope,
) ([]contentadapter.Task, error) {
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

	passedIDs, reviewCandidates, pendingRetryIDs := s.loadTaskPickerHints(ctx, userID, taskType)

	if scope == interviewmodel.PracticeScopeReview {
		reviewPool := filterTasksByIDs(matched, reviewCandidateTaskIDs(reviewCandidates))
		if len(reviewPool) > 0 {
			return reviewPool, nil
		}
	}

	filtered := filterTasksExcludingIDs(matched, unionTaskIDs(passedIDs, pendingRetryIDs))
	if len(filtered) == 0 {
		filtered = matched
	}
	return filtered, nil
}

func (s *interviewService) loadTaskPickerHints(
	ctx context.Context,
	userID, taskType string,
) (passedIDs []string, reviewCandidates []recommendationadapter.ReviewCandidate, pendingRetryIDs []string) {
	if s.recommendation != nil {
		passed, review, err := s.recommendation.GetTaskPickerHints(ctx, userID, taskType)
		if err == nil {
			passedIDs = passed
			reviewCandidates = review
		}
	}

	localRetry, err := s.repo.ListPendingRetryTaskIDsForUser(ctx, userID)
	if err == nil {
		pendingRetryIDs = localRetry
	}
	return passedIDs, reviewCandidates, pendingRetryIDs
}

func reviewCandidateTaskIDs(candidates []recommendationadapter.ReviewCandidate) []string {
	out := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		if candidate.TaskID != "" {
			out = append(out, candidate.TaskID)
		}
	}
	return out
}

func unionTaskIDs(groups ...[]string) map[string]struct{} {
	out := make(map[string]struct{})
	for _, group := range groups {
		for _, id := range group {
			if id == "" {
				continue
			}
			out[id] = struct{}{}
		}
	}
	return out
}

func filterTasksByIDs(tasks []contentadapter.Task, includeIDs []string) []contentadapter.Task {
	if len(includeIDs) == 0 {
		return nil
	}
	allowed := make(map[string]struct{}, len(includeIDs))
	for _, id := range includeIDs {
		if id != "" {
			allowed[id] = struct{}{}
		}
	}
	out := make([]contentadapter.Task, 0, len(includeIDs))
	for _, task := range tasks {
		if _, ok := allowed[task.ID]; ok {
			out = append(out, task)
		}
	}
	return out
}

func filterTasksExcludingIDs(tasks []contentadapter.Task, excludeIDs map[string]struct{}) []contentadapter.Task {
	if len(excludeIDs) == 0 {
		return append([]contentadapter.Task(nil), tasks...)
	}
	out := make([]contentadapter.Task, 0, len(tasks))
	for _, task := range tasks {
		if _, excluded := excludeIDs[task.ID]; excluded {
			continue
		}
		out = append(out, task)
	}
	return out
}

func pickTasks(tasks []contentadapter.Task, count int) []contentadapter.Task {
	if count <= 0 || len(tasks) == 0 {
		return nil
	}
	if count >= len(tasks) {
		return append([]contentadapter.Task(nil), tasks...)
	}
	shuffleTasks(tasks)
	return append([]contentadapter.Task(nil), tasks[:count]...)
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
