package cache

import (
	"context"
	"encoding/json"
	"fmt"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
)

// LoaderSource loads catalog rows for snapshot construction.
type LoaderSource interface {
	ListCompanies(ctx context.Context, f catalogrepo.ListCompaniesFilter) ([]catalogmodel.Company, error)
	ListInterviewTemplates(ctx context.Context, f catalogrepo.ListTemplatesFilter) ([]catalogmodel.InterviewTemplate, error)
	ListTemplateSections(ctx context.Context, templateID string) ([]catalogmodel.TemplateSection, error)
	ListTasks(ctx context.Context, f catalogrepo.ListTasksFilter) ([]catalogmodel.Task, error)
	ListTaskSolutions(ctx context.Context, taskID string) ([]catalogmodel.Solution, error)
	GetActiveRubricByTaskType(ctx context.Context, taskType string) (*catalogmodel.Rubric, error)
	ListRubricCriteria(ctx context.Context, rubricID string) ([]catalogmodel.RubricCriterion, error)
	ListArticles(ctx context.Context, f catalogrepo.ListArticlesFilter) ([]catalogmodel.Article, error)
	GetArticleByID(ctx context.Context, id string) (*catalogmodel.Article, error)
}

// Load builds a snapshot from the persistence layer.
func Load(ctx context.Context, src LoaderSource, version int64) (*Snapshot, error) {
	companies, err := src.ListCompanies(ctx, catalogrepo.ListCompaniesFilter{
		Limit: loaderPageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("load companies: %w", err)
	}

	templates, err := src.ListInterviewTemplates(ctx, catalogrepo.ListTemplatesFilter{
		Limit: loaderPageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("load templates: %w", err)
	}

	templateDetailByID := make(map[string]catalogmodel.InterviewTemplateDetail, len(templates))
	templateDetailBySlug := make(map[string]catalogmodel.InterviewTemplateDetail, len(templates))
	for _, tmpl := range templates {
		sections, err := src.ListTemplateSections(ctx, tmpl.ID)
		if err != nil {
			return nil, fmt.Errorf("load template sections %s: %w", tmpl.ID, err)
		}
		copyTemplate := tmpl
		detail := catalogmodel.InterviewTemplateDetail{
			Template: &copyTemplate,
			Sections: sections,
		}
		templateDetailByID[tmpl.ID] = detail
		templateDetailBySlug[tmpl.Slug] = detail
	}

	taskStatuses := []string{"published", "draft", "archived"}
	taskByID := make(map[string]catalogmodel.Task)
	for _, status := range taskStatuses {
		st := status
		tasks, err := src.ListTasks(ctx, catalogrepo.ListTasksFilter{
			Status: &st,
			Limit:  loaderPageSize,
		})
		if err != nil {
			return nil, fmt.Errorf("load tasks status=%s: %w", status, err)
		}
		for _, task := range tasks {
			taskByID[task.ID] = task
		}
	}
	allTasks := make([]catalogmodel.Task, 0, len(taskByID))
	taskBySlug := make(map[string]catalogmodel.Task, len(taskByID))
	for _, task := range taskByID {
		allTasks = append(allTasks, task)
		taskBySlug[task.Slug] = task
	}

	bundleByTaskID := make(map[string]catalogmodel.TaskBundle, len(taskByID))
	rubricByID := make(map[string]catalogmodel.Rubric)
	rubricCriteriaByID := make(map[string][]catalogmodel.RubricCriterion)
	rubricByTaskType := make(map[string]*catalogmodel.Rubric)
	for _, task := range taskByID {
		solutions, err := src.ListTaskSolutions(ctx, task.ID)
		if err != nil {
			return nil, fmt.Errorf("load solutions task=%s: %w", task.ID, err)
		}
		rubric, ok := rubricByTaskType[task.Type]
		if !ok {
			rubric, err = src.GetActiveRubricByTaskType(ctx, task.Type)
			if err != nil {
				return nil, fmt.Errorf("load rubric type=%s: %w", task.Type, err)
			}
			rubricByTaskType[task.Type] = rubric
			rubricByID[rubric.ID] = *rubric
			criteria, err := src.ListRubricCriteria(ctx, rubric.ID)
			if err != nil {
				return nil, fmt.Errorf("load rubric criteria %s: %w", rubric.ID, err)
			}
			rubricCriteriaByID[rubric.ID] = criteria
		}
		copyTask := task
		copyRubric := *rubric
		bundleByTaskID[task.ID] = catalogmodel.TaskBundle{
			Task:      &copyTask,
			Solutions: solutions,
			Rubric:    &copyRubric,
			Criteria:  append([]catalogmodel.RubricCriterion(nil), rubricCriteriaByID[rubric.ID]...),
		}
	}

	articleSummaries, err := src.ListArticles(ctx, catalogrepo.ListArticlesFilter{
		AllStatuses: true,
		Limit:       loaderPageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("load articles: %w", err)
	}
	articles := make([]catalogmodel.Article, 0, len(articleSummaries))
	articleByID := make(map[string]catalogmodel.Article, len(articleSummaries))
	articleBySlug := make(map[string]catalogmodel.Article, len(articleSummaries))
	articlesBySkillKey := make(map[string][]catalogmodel.Article)
	for _, summary := range articleSummaries {
		full, err := src.GetArticleByID(ctx, summary.ID)
		if err != nil {
			return nil, fmt.Errorf("load article %s: %w", summary.ID, err)
		}
		articles = append(articles, *full)
		articleByID[full.ID] = *full
		articleBySlug[full.Slug] = *full
		if full.Status == catalogmodel.ArticleStatusPublished {
			for _, key := range full.SkillKeys {
				articlesBySkillKey[key] = append(articlesBySkillKey[key], *full)
			}
		}
	}

	companyByID := make(map[string]catalogmodel.Company, len(companies))
	companyBySlug := make(map[string]catalogmodel.Company, len(companies))
	for _, c := range companies {
		companyByID[c.ID] = c
		companyBySlug[c.Slug] = c
	}
	templateByID := make(map[string]catalogmodel.InterviewTemplate, len(templates))
	templateBySlug := make(map[string]catalogmodel.InterviewTemplate, len(templates))
	for _, t := range templates {
		templateByID[t.ID] = t
		templateBySlug[t.Slug] = t
	}

	snap := &Snapshot{
		Version:              version,
		companies:            companies,
		companyByID:          companyByID,
		companyBySlug:        companyBySlug,
		templates:            templates,
		templateByID:         templateByID,
		templateBySlug:       templateBySlug,
		templateDetailByID:   templateDetailByID,
		templateDetailBySlug: templateDetailBySlug,
		tasks:                allTasks,
		taskByID:             taskByID,
		taskBySlug:           taskBySlug,
		bundleByTaskID:       bundleByTaskID,
		rubricByID:           rubricByID,
		rubricCriteriaByID:   rubricCriteriaByID,
		articles:             articles,
		articleByID:          articleByID,
		articleBySlug:        articleBySlug,
		articlesBySkillKey:   articlesBySkillKey,
	}
	snap.estimatedBytes = estimateSnapshotBytes(snap)
	return snap, nil
}

func estimateSnapshotBytes(s *Snapshot) int64 {
	raw, err := json.Marshal(struct {
		Companies int `json:"companies"`
		Templates int `json:"templates"`
		Tasks     int `json:"tasks"`
		Bundles   int `json:"bundles"`
		Articles  int `json:"articles"`
		Rubrics   int `json:"rubrics"`
	}{
		len(s.companies),
		len(s.templates),
		len(s.tasks),
		len(s.bundleByTaskID),
		len(s.articles),
		len(s.rubricByID),
	})
	if err != nil {
		return 0
	}
	var body int64
	for _, t := range s.tasks {
		body += int64(len(t.Metadata) + len(t.Title) + len(t.Description))
	}
	for _, a := range s.articles {
		body += int64(len(a.Body) + len(a.Title) + len(a.Summary))
	}
	return int64(len(raw)) + body
}
