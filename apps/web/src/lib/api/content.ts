import { api } from '@/lib/apiClient'
import { asArray } from '@/lib/api/normalize'
import type { Company, InterviewTemplate, Task, TemplateSection, Article, ArticleSummary } from '@/lib/types'

export function listCompanies(activeOnly = true) {
  const q = activeOnly ? '?active_only=true' : ''
  return api<{ companies?: Company[] }>(`/companies${q}`).then((res) => ({
    companies: asArray(res.companies),
  }))
}

export function listInterviewTemplates(companyId?: string, activeOnly = true) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  if (activeOnly) params.set('active_only', 'true')
  const q = params.toString()
  return api<{ templates?: InterviewTemplate[] }>(`/interview-templates${q ? `?${q}` : ''}`).then(
    (res) => ({
      templates: asArray(res.templates),
    }),
  )
}

export function getInterviewTemplateDetail(id: string) {
  return api<{ template: InterviewTemplate; sections?: TemplateSection[] }>(
    `/interview-templates/${id}/detail`,
  ).then((res) => ({
    template: res.template,
    sections: asArray(res.sections),
  }))
}

export function getTask(id: string) {
  return api<{ task: Task }>(`/tasks/${id}`)
}

export function getArticle(slug: string) {
  return api<{ article: Article; related_articles?: ArticleSummary[] }>(
    `/articles/by-slug/${slug}`,
  ).then((res) => ({
    article: res.article,
    related_articles: asArray(res.related_articles),
  }))
}

export function listArticles(params?: { skill_key?: string; query?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.skill_key) qs.set('skill_key', params.skill_key)
  if (params?.query) qs.set('query', params.query)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.offset != null) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return api<{ articles?: ArticleSummary[] }>(`/articles${q ? `?${q}` : ''}`).then((res) => ({
    articles: asArray(res.articles),
  }))
}
