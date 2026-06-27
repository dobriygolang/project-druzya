package service

import (
	interviewmodel "github.com/sedorofeevd/project-druzya/services/interview/internal/interview/model"
)

func computeProgress(sections []interviewmodel.SessionSection, tasks []interviewmodel.SessionTask) interviewmodel.Progress {
	progress := interviewmodel.Progress{
		TotalTasks:    len(tasks),
		TotalSections: len(sections),
	}
	for _, t := range tasks {
		switch t.Status {
		case interviewmodel.SessionTaskEvaluated:
			progress.EvaluatedTasks++
		case interviewmodel.SessionTaskSkipped:
			progress.SkippedTasks++
		}
	}
	for _, s := range sections {
		if s.Status == interviewmodel.SectionStatusCompleted {
			progress.DoneSections++
		}
	}
	return progress
}

func findCurrentSection(sections []interviewmodel.SessionSection) *interviewmodel.SessionSection {
	for i := range sections {
		if sections[i].Status == interviewmodel.SectionStatusActive {
			return &sections[i]
		}
	}
	for i := range sections {
		if sections[i].Status == interviewmodel.SectionStatusPending {
			return &sections[i]
		}
	}
	return nil
}

func findCurrentTask(section *interviewmodel.SessionSection, tasks []interviewmodel.SessionTask) *interviewmodel.SessionTask {
	if section == nil {
		return nil
	}
	for i := range tasks {
		if tasks[i].SectionID != section.ID {
			continue
		}
		switch tasks[i].Status {
		case interviewmodel.SessionTaskAssigned, interviewmodel.SessionTaskSubmitted:
			return &tasks[i]
		}
	}
	return nil
}

func allTasksDone(tasks []interviewmodel.SessionTask) bool {
	if len(tasks) == 0 {
		return false
	}
	for _, t := range tasks {
		switch t.Status {
		case interviewmodel.SessionTaskEvaluated, interviewmodel.SessionTaskSkipped:
			continue
		default:
			return false
		}
	}
	return true
}
