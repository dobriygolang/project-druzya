package service

import (
	"testing"

	contentadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/content"
	interviewadapter "github.com/sedorofeevd/project-druzya/services/recommendation/internal/adapter/interview"
	"github.com/sedorofeevd/project-druzya/services/recommendation/internal/recommendation/model"
)

func TestBuildDailyBrief_RetryAndWeakness(t *testing.T) {
	taskID := "task-1"
	retryID := "retry-1"
	skillKey := "algorithm.arrays"

	brief := buildDailyBrief(
		"ru",
		58,
		[]model.SkillInsight{{SkillKey: skillKey, Score: 52, Confidence: 40}},
		nil,
		[]interviewadapter.RetryItem{{ID: retryID, TaskID: taskID}},
		map[string]string{taskID: "Two Sum"},
		nil,
		nil,
		nil,
	)

	if len(brief.Items) < 2 {
		t.Fatalf("expected retry + weakness items, got %d", len(brief.Items))
	}
	if brief.Items[0].Type != model.DailyBriefItemTypeRetryTask {
		t.Fatalf("first item type = %q", brief.Items[0].Type)
	}
	if brief.Items[0].RetryItemID == nil || *brief.Items[0].RetryItemID != retryID {
		t.Fatalf("retry_item_id = %v", brief.Items[0].RetryItemID)
	}
	if brief.Items[1].Type != model.DailyBriefItemTypeWeakSkill {
		t.Fatalf("second item type = %q", brief.Items[1].Type)
	}
}

func TestBuildDailyBrief_WeaknessUsesArticle(t *testing.T) {
	skillKey := "algorithm.arrays"
	brief := buildDailyBrief(
		"ru",
		58,
		[]model.SkillInsight{{SkillKey: skillKey, Score: 52, Confidence: 40}},
		nil,
		nil,
		nil,
		map[string]contentadapter.Article{
			skillKey: {
				Slug:      "arrays-and-two-pointers",
				Title:     "Arrays & two pointers",
				Summary:   "Pattern guide",
				SkillKeys: []string{skillKey},
			},
		},
		nil,
		nil,
	)

	if len(brief.Items) != 1 {
		t.Fatalf("expected one article item, got %d", len(brief.Items))
	}
	if brief.Items[0].Type != model.DailyBriefItemTypeReadArticle {
		t.Fatalf("type = %q", brief.Items[0].Type)
	}
	if brief.Items[0].ActionPath == nil || *brief.Items[0].ActionPath != "/learn/arrays-and-two-pointers" {
		t.Fatalf("action_path = %v", brief.Items[0].ActionPath)
	}
	if brief.Items[0].SecondaryActionPath == nil || *brief.Items[0].SecondaryActionPath != "/mock?solo=algo" {
		t.Fatalf("secondary_action_path = %v", brief.Items[0].SecondaryActionPath)
	}
}

func TestBuildDailyBrief_WeaknessUsesPracticeAfterRead(t *testing.T) {
	skillKey := "algorithm.arrays"
	slug := "arrays-and-two-pointers"
	brief := buildDailyBrief(
		"ru",
		58,
		[]model.SkillInsight{{SkillKey: skillKey, Score: 52, Confidence: 40}},
		nil,
		nil,
		nil,
		map[string]contentadapter.Article{
			skillKey: {Slug: slug, Title: "Arrays & two pointers", Summary: "Pattern guide"},
		},
		map[string]struct{}{slug: {}},
		nil,
	)

	if len(brief.Items) != 1 {
		t.Fatalf("expected one practice item, got %d", len(brief.Items))
	}
	if brief.Items[0].Type != model.DailyBriefItemTypeWeakSkill {
		t.Fatalf("type = %q", brief.Items[0].Type)
	}
	if brief.Items[0].ActionPath == nil || *brief.Items[0].ActionPath != "/mock?solo=algo" {
		t.Fatalf("action_path = %v", brief.Items[0].ActionPath)
	}
}

func TestBuildDailyBrief_EmptyProfileStartMock(t *testing.T) {
	brief := buildDailyBrief("ru", 0, nil, nil, nil, nil, nil, nil, nil)
	if len(brief.Items) != 1 {
		t.Fatalf("expected onboarding item, got %d", len(brief.Items))
	}
	if brief.Items[0].Type != model.DailyBriefItemTypeStartMock {
		t.Fatalf("type = %q", brief.Items[0].Type)
	}
}
