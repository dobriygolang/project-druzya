package service

import (
	"context"
	"fmt"
	"time"

	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

const StalePracticeDays = 14

var trackedTrainingModes = []struct {
	Mode     string
	TaskType string
}{
	{Mode: "algorithms_training", TaskType: "algorithm"},
	{Mode: "live_coding_training", TaskType: "live_coding"},
	{Mode: "system_design_training", TaskType: "system_design"},
	{Mode: "behavioral_training", TaskType: "behavioral"},
}

func (s *recommendationService) GetTaskPickerHints(ctx context.Context, userID, taskType string) (*model.TaskPickerHints, error) {
	if userID == "" || taskType == "" {
		return nil, fmt.Errorf("user_id and task_type required: %w", ErrInvalidInput)
	}

	staleAfter := time.Now().UTC().AddDate(0, 0, -StalePracticeDays)

	passedIDs, err := s.repo.ListPassedTaskIDsByType(ctx, userID, taskType)
	if err != nil {
		return nil, fmt.Errorf("list passed task ids: %w", err)
	}

	reviewCandidates, err := s.repo.ListReviewTaskCandidates(ctx, userID, taskType, staleAfter, 20)
	if err != nil {
		return nil, fmt.Errorf("list review candidates: %w", err)
	}

	return &model.TaskPickerHints{
		PassedTaskIDs:    passedIDs,
		ReviewCandidates: reviewCandidates,
	}, nil
}

func (s *recommendationService) GetMockHubContext(ctx context.Context, userID string) (*model.MockHubContext, error) {
	if userID == "" {
		return nil, fmt.Errorf("user_id required: %w", ErrInvalidInput)
	}

	activity, err := s.repo.ListPracticeModeActivity(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list practice mode activity: %w", err)
	}

	templateProgress, err := s.repo.ListUserTemplateProgress(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list template progress: %w", err)
	}

	coverage, err := s.repo.ListTaskTypeCoverage(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list task type coverage: %w", err)
	}

	return &model.MockHubContext{
		StaleModes:       computeStalePracticeModes(activity, time.Now().UTC()),
		TemplateProgress: templateProgress,
		TaskTypeCoverage: coverage,
	}, nil
}

func computeStalePracticeModes(activity []model.UserPracticeModeActivity, now time.Time) []model.StalePracticeMode {
	byMode := make(map[string]model.UserPracticeModeActivity, len(activity))
	for _, a := range activity {
		byMode[a.SessionMode] = a
	}

	staleCutoff := now.AddDate(0, 0, -StalePracticeDays)
	var out []model.StalePracticeMode

	for _, tracked := range trackedTrainingModes {
		a, practiced := byMode[tracked.Mode]
		if !practiced {
			out = append(out, model.StalePracticeMode{
				SessionMode: tracked.Mode,
				TaskType:    tracked.TaskType,
				DaysSince:   StalePracticeDays,
			})
			continue
		}
		if a.LastPracticedAt.Before(staleCutoff) {
			days := int(now.Sub(a.LastPracticedAt).Hours() / 24)
			if days < StalePracticeDays {
				days = StalePracticeDays
			}
			lastAt := a.LastPracticedAt
			out = append(out, model.StalePracticeMode{
				SessionMode:     tracked.Mode,
				TaskType:        tracked.TaskType,
				LastPracticedAt: &lastAt,
				DaysSince:       days,
			})
		}
	}
	return out
}

func soloIDFromSessionMode(mode string) string {
	switch mode {
	case "algorithms_training":
		return "algo"
	case "live_coding_training":
		return "coding"
	case "system_design_training":
		return "sysdesign"
	case "behavioral_training":
		return "behavioral"
	default:
		return ""
	}
}
