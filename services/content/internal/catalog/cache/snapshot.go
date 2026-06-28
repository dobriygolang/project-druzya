package cache

import (
	"sort"
	"strings"

	catalogmodel "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/model"
	catalogrepo "github.com/sedorofeevd/project-druzya/services/content/internal/catalog/repository"
)

const loaderPageSize = 10_000

// Snapshot is an in-memory read-only catalog index built from Postgres.
type Snapshot struct {
	Version int64

	companies              []catalogmodel.Company
	companyByID            map[string]catalogmodel.Company
	companyBySlug          map[string]catalogmodel.Company
	templates              []catalogmodel.InterviewTemplate
	templateByID           map[string]catalogmodel.InterviewTemplate
	templateBySlug         map[string]catalogmodel.InterviewTemplate
	templateDetailByID     map[string]catalogmodel.InterviewTemplateDetail
	templateDetailBySlug   map[string]catalogmodel.InterviewTemplateDetail
	tasks                  []catalogmodel.Task
	taskByID               map[string]catalogmodel.Task
	taskBySlug             map[string]catalogmodel.Task
	bundleByTaskID         map[string]catalogmodel.TaskBundle
	rubricByID             map[string]catalogmodel.Rubric
	rubricCriteriaByID     map[string][]catalogmodel.RubricCriterion
	articles               []catalogmodel.Article
	articleByID            map[string]catalogmodel.Article
	articleBySlug          map[string]catalogmodel.Article
	articlesBySkillKey     map[string][]catalogmodel.Article
	estimatedBytes         int64
}

func (s *Snapshot) EstimatedBytes() int64 {
	if s == nil {
		return 0
	}
	return s.estimatedBytes
}

func (s *Snapshot) ListCompanies(f catalogrepo.ListCompaniesFilter) []catalogmodel.Company {
	if s == nil {
		return nil
	}
	out := make([]catalogmodel.Company, 0, len(s.companies))
	for _, c := range s.companies {
		if f.ActiveOnly && !c.IsActive {
			continue
		}
		out = append(out, c)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return paginate(out, f.Limit, f.Offset)
}

func (s *Snapshot) GetCompanyByID(id string) (*catalogmodel.Company, bool) {
	if s == nil {
		return nil, false
	}
	c, ok := s.companyByID[id]
	if !ok {
		return nil, false
	}
	copyItem := c
	return &copyItem, true
}

func (s *Snapshot) GetCompanyBySlug(slug string) (*catalogmodel.Company, bool) {
	if s == nil {
		return nil, false
	}
	c, ok := s.companyBySlug[slug]
	if !ok {
		return nil, false
	}
	copyItem := c
	return &copyItem, true
}

func (s *Snapshot) ListInterviewTemplates(f catalogrepo.ListTemplatesFilter) []catalogmodel.InterviewTemplate {
	if s == nil {
		return nil
	}
	out := make([]catalogmodel.InterviewTemplate, 0, len(s.templates))
	for _, t := range s.templates {
		if f.CompanyID != nil && (t.CompanyID == nil || *t.CompanyID != *f.CompanyID) {
			continue
		}
		if f.ActiveOnly && !t.IsActive {
			continue
		}
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Title < out[j].Title })
	return paginate(out, f.Limit, f.Offset)
}

func (s *Snapshot) GetInterviewTemplateDetail(id, slug string) (*catalogmodel.InterviewTemplateDetail, bool) {
	if s == nil {
		return nil, false
	}
	switch {
	case id != "":
		d, ok := s.templateDetailByID[id]
		if !ok {
			return nil, false
		}
		return copyTemplateDetail(&d), true
	case slug != "":
		d, ok := s.templateDetailBySlug[slug]
		if !ok {
			return nil, false
		}
		return copyTemplateDetail(&d), true
	default:
		return nil, false
	}
}

func (s *Snapshot) ListTasks(f catalogrepo.ListTasksFilter) []catalogmodel.Task {
	if s == nil {
		return nil
	}
	status := f.Status
	if status == nil {
		defaultStatus := "published"
		status = &defaultStatus
	}
	out := make([]catalogmodel.Task, 0, len(s.tasks))
	for _, t := range s.tasks {
		if f.Type != nil && t.Type != *f.Type {
			continue
		}
		if f.Difficulty != nil && t.Difficulty != *f.Difficulty {
			continue
		}
		if t.Status != *status {
			continue
		}
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Title < out[j].Title })
	return paginate(out, f.Limit, f.Offset)
}

func (s *Snapshot) GetTaskByID(id string) (*catalogmodel.Task, bool) {
	if s == nil {
		return nil, false
	}
	t, ok := s.taskByID[id]
	if !ok {
		return nil, false
	}
	copyItem := t
	return &copyItem, true
}

func (s *Snapshot) GetTaskBySlug(slug string) (*catalogmodel.Task, bool) {
	if s == nil {
		return nil, false
	}
	t, ok := s.taskBySlug[slug]
	if !ok {
		return nil, false
	}
	copyItem := t
	return &copyItem, true
}

func (s *Snapshot) GetTaskBundle(taskID string) (*catalogmodel.TaskBundle, bool) {
	if s == nil {
		return nil, false
	}
	b, ok := s.bundleByTaskID[taskID]
	if !ok {
		return nil, false
	}
	return copyTaskBundle(&b), true
}

func (s *Snapshot) GetRubricByID(id string) (*catalogmodel.Rubric, []catalogmodel.RubricCriterion, bool) {
	if s == nil {
		return nil, nil, false
	}
	r, ok := s.rubricByID[id]
	if !ok {
		return nil, nil, false
	}
	criteria := append([]catalogmodel.RubricCriterion(nil), s.rubricCriteriaByID[id]...)
	copyRubric := r
	return &copyRubric, criteria, true
}

func (s *Snapshot) ListArticles(f catalogrepo.ListArticlesFilter) []catalogmodel.Article {
	if s == nil {
		return nil
	}
	if f.AllStatuses {
		return nil
	}
	out := make([]catalogmodel.Article, 0, len(s.articles))
	for _, a := range s.articles {
		if !articleMatchesFilter(a, f) {
			continue
		}
		out = append(out, a)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return paginate(out, f.Limit, f.Offset)
}

func (s *Snapshot) ListPublishedArticlesBySkillKeys(skillKeys []string) []catalogmodel.Article {
	if s == nil || len(skillKeys) == 0 {
		return nil
	}
	byID := make(map[string]*catalogmodel.Article)
	var order []string
	for _, skillKey := range skillKeys {
		candidates := s.articlesBySkillKey[skillKey]
		if len(candidates) == 0 {
			continue
		}
		best := candidates[0]
		for _, c := range candidates[1:] {
			if c.UpdatedAt.After(best.UpdatedAt) {
				best = c
			}
		}
		existing, ok := byID[best.ID]
		if !ok {
			copyItem := best
			copyItem.Body = ""
			copyItem.SkillKeys = []string{skillKey}
			byID[best.ID] = &copyItem
			order = append(order, best.ID)
			continue
		}
		existing.SkillKeys = append(existing.SkillKeys, skillKey)
	}
	out := make([]catalogmodel.Article, 0, len(order))
	for _, id := range order {
		out = append(out, *byID[id])
	}
	return out
}

func (s *Snapshot) GetArticleByID(id string) (*catalogmodel.Article, bool) {
	if s == nil {
		return nil, false
	}
	a, ok := s.articleByID[id]
	if !ok {
		return nil, false
	}
	return copyArticle(&a), true
}

func (s *Snapshot) GetArticleBySlug(slug string) (*catalogmodel.Article, bool) {
	if s == nil {
		return nil, false
	}
	a, ok := s.articleBySlug[slug]
	if !ok {
		return nil, false
	}
	return copyArticle(&a), true
}

func (s *Snapshot) ListRelatedArticles(articleID string, skillKeys []string, limit int) []catalogmodel.Article {
	if s == nil || articleID == "" {
		return nil
	}
	if limit <= 0 {
		limit = 5
	}
	keySet := make(map[string]struct{}, len(skillKeys))
	for _, k := range skillKeys {
		keySet[k] = struct{}{}
	}
	var out []catalogmodel.Article
	for _, a := range s.articles {
		if a.ID == articleID || a.Status != catalogmodel.ArticleStatusPublished {
			continue
		}
		if !articleSharesSkill(a, keySet) {
			continue
		}
		copyItem := a
		copyItem.Body = ""
		out = append(out, copyItem)
		if len(out) >= limit {
			break
		}
	}
	return out
}

func articleMatchesFilter(a catalogmodel.Article, f catalogrepo.ListArticlesFilter) bool {
	status := f.Status
	if status == nil {
		defaultStatus := catalogmodel.ArticleStatusPublished
		status = &defaultStatus
	}
	if a.Status != *status {
		return false
	}
	if f.SkillKey != nil {
		found := false
		for _, k := range a.SkillKeys {
			if k == *f.SkillKey {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	if f.Query != nil && strings.TrimSpace(*f.Query) != "" {
		q := strings.ToLower(strings.TrimSpace(*f.Query))
		if !strings.Contains(strings.ToLower(a.Title), q) &&
			!strings.Contains(strings.ToLower(a.Summary), q) &&
			!strings.Contains(strings.ToLower(a.Slug), q) &&
			!strings.Contains(strings.ToLower(a.Body), q) {
			return false
		}
	}
	return true
}

func articleSharesSkill(a catalogmodel.Article, keys map[string]struct{}) bool {
	for _, k := range a.SkillKeys {
		if _, ok := keys[k]; ok {
			return true
		}
	}
	return false
}

func paginate[T any](items []T, limit, offset int) []T {
	if offset >= len(items) {
		return nil
	}
	items = items[offset:]
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items
}

func copyTemplateDetail(d *catalogmodel.InterviewTemplateDetail) *catalogmodel.InterviewTemplateDetail {
	if d == nil {
		return nil
	}
	out := catalogmodel.InterviewTemplateDetail{
		Template: d.Template,
		Sections: append([]catalogmodel.TemplateSection(nil), d.Sections...),
	}
	if d.Template != nil {
		t := *d.Template
		out.Template = &t
	}
	return &out
}

func copyTaskBundle(b *catalogmodel.TaskBundle) *catalogmodel.TaskBundle {
	if b == nil {
		return nil
	}
	out := catalogmodel.TaskBundle{
		Solutions: append([]catalogmodel.Solution(nil), b.Solutions...),
		Criteria:  append([]catalogmodel.RubricCriterion(nil), b.Criteria...),
	}
	if b.Task != nil {
		t := *b.Task
		out.Task = &t
	}
	if b.Rubric != nil {
		r := *b.Rubric
		out.Rubric = &r
	}
	return &out
}

func copyArticle(a *catalogmodel.Article) *catalogmodel.Article {
	if a == nil {
		return nil
	}
	out := *a
	out.SkillKeys = append([]string(nil), a.SkillKeys...)
	out.Videos = append([]catalogmodel.ArticleVideo(nil), a.Videos...)
	out.LinkedTasks = append([]catalogmodel.ArticleTaskLink(nil), a.LinkedTasks...)
	out.TaskIDs = append([]string(nil), a.TaskIDs...)
	return &out
}
