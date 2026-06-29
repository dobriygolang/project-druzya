import { api, ApiError } from '@/lib/apiClient'

export interface AdminSession {
  user_id: string
}

export interface AdminCompany {
  id: string
  slug: string
  name: string
  description?: string
  is_active: boolean
}

export interface AdminTask {
  id: string
  slug: string
  type: string
  title: string
  description: string
  difficulty: string
  estimated_minutes?: number
  status: string
}

export interface AdminTaskSolution {
  id: string
  task_id: string
  language?: string
  solution_text: string
  explanation?: string
  complexity?: string
  is_primary: boolean
}

export type AdminArticleStatus =
  | 'ARTICLE_STATUS_UNSPECIFIED'
  | 'ARTICLE_STATUS_DRAFT'
  | 'ARTICLE_STATUS_PUBLISHED'
  | 'ARTICLE_STATUS_ARCHIVED'

export type AdminArticleVideoProvider =
  | 'ARTICLE_VIDEO_PROVIDER_UNSPECIFIED'
  | 'ARTICLE_VIDEO_PROVIDER_YOUTUBE'
  | 'ARTICLE_VIDEO_PROVIDER_VIMEO'
  | 'ARTICLE_VIDEO_PROVIDER_OTHER'

export interface AdminArticleVideo {
  title: string
  url: string
  provider: AdminArticleVideoProvider
  position: number
  duration_seconds?: number
}

export interface AdminArticleTaskLink {
  task_id: string
  slug: string
  title: string
  type: string
  difficulty: string
  position: number
}

export interface AdminArticle {
  id: string
  slug: string
  title: string
  summary: string
  body: string
  status: AdminArticleStatus
  reading_minutes?: number
  skill_keys?: string[]
  videos?: AdminArticleVideo[]
  linked_tasks?: AdminArticleTaskLink[]
}

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    return await api<AdminSession>('/admin/session', {}, { redirectOnUnauthorized: false })
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 401)) {
      return null
    }
    throw err
  }
}

export interface AdminServiceHealth {
  name: string
  ok: boolean
  error?: string
}

export interface AdminDashboard {
  services: AdminServiceHealth[]
  catalog: {
    companies: number
    tasks: number
    templates: number
    plans: number
    articles?: number
  }
  evaluation_jobs: {
    pending: number
    running: number
    failed: number
    completed: number
  }
  users?: {
    total_users: number
    new_users_24h: number
    new_users_7d: number
    new_users_30d: number
    active_users_7d: number
    active_subscriptions: number
  }
  runtimes?: Array<{
    name: string
    database_name: string
    database_size_bytes: number
    memory_alloc_bytes: number
    memory_sys_bytes: number
    goroutines: number
    http_rps: number
  }>
  total_http_rps?: number
  total_database_size_bytes?: number
  recent_failed_jobs: Array<{
    id: string
    attempt_id: string
    user_id: string
    status: string
    error?: string
    updated_at?: string
  }>
  llm_config?: AdminLLMConfig
}

export function getAdminDashboard() {
  return api<AdminDashboard>('/admin/dashboard')
}

export function listAdminCompanies(params?: { active_only?: boolean; limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.active_only) qs.set('active_only', 'true')
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.offset != null) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return api<{ companies: AdminCompany[] }>(`/admin/content/companies${q ? `?${q}` : ''}`)
}

export function upsertAdminCompany(body: {
  id?: string
  slug: string
  name: string
  description?: string
  is_active: boolean
}) {
  return api<{ company: AdminCompany }>('/admin/content/companies', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listAdminTasks(params?: {
  type?: string
  difficulty?: string
  status?: string
  limit?: number
  offset?: number
}) {
  const qs = new URLSearchParams()
  if (params?.type) qs.set('type', params.type)
  if (params?.difficulty) qs.set('difficulty', params.difficulty)
  if (params?.status) qs.set('status', params.status)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.offset != null) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return api<{ tasks: AdminTask[] }>(`/admin/content/tasks${q ? `?${q}` : ''}`)
}

export function getAdminTask(params: { id?: string; slug?: string }) {
  const path = params.slug
    ? `/admin/content/tasks/by-slug/${encodeURIComponent(params.slug)}`
    : `/admin/content/tasks/${encodeURIComponent(params.id ?? '')}`
  return api<{ task: AdminTask; solutions?: AdminTaskSolution[] }>(path)
}

export function upsertAdminTask(body: {
  id?: string
  slug: string
  type: string
  title: string
  description: string
  difficulty: string
  estimated_minutes?: number
  status: string
}) {
  return api<{ task: AdminTask }>('/admin/content/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function replaceAdminTaskSolutions(
  taskId: string,
  solutions: Array<{
    id?: string
    language?: string
    solution_text: string
    explanation?: string
    complexity?: string
    is_primary: boolean
  }>,
) {
  return api<{ solutions: AdminTaskSolution[] }>(
    `/admin/content/tasks/${encodeURIComponent(taskId)}/solutions`,
    {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, solutions }),
    },
  )
}

export function listAdminArticles(params?: { status?: AdminArticleStatus; limit?: number; offset?: number }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.offset != null) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return api<{ articles: AdminArticle[] }>(`/admin/content/articles${q ? `?${q}` : ''}`)
}

export function getAdminArticle(slug: string) {
  return api<{ article: AdminArticle }>(
    `/admin/content/articles/by-slug/${encodeURIComponent(slug)}`,
  )
}

export function upsertAdminArticle(body: {
  id?: string
  slug: string
  title: string
  summary: string
  body: string
  status: AdminArticleStatus
  reading_minutes?: number
  skill_keys?: string[]
  videos?: AdminArticleVideo[]
  task_slugs?: string[]
}) {
  return api<{ article: AdminArticle }>('/admin/content/articles', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export interface AdminInterviewTemplate {
  id: string
  company_id?: string
  slug: string
  title: string
  description?: string
  target_role?: string
  target_level?: string
  passing_score: number
  is_active: boolean
}

export interface AdminTemplateSection {
  id: string
  template_id: string
  section_type: string
  title: string
  description?: string
  position: number
  passing_score?: number
  tasks_count: number
  task_ids: string[]
}

export function listAdminInterviewTemplates(params?: {
  company_id?: string
  active_only?: boolean
  limit?: number
  offset?: number
}) {
  const qs = new URLSearchParams()
  if (params?.company_id) qs.set('company_id', params.company_id)
  if (params?.active_only) qs.set('active_only', 'true')
  if (params?.limit != null) qs.set('limit', String(params.limit))
  if (params?.offset != null) qs.set('offset', String(params.offset))
  const q = qs.toString()
  return api<{ templates: AdminInterviewTemplate[] }>(
    `/admin/content/interview-templates${q ? `?${q}` : ''}`,
  )
}

export function getAdminInterviewTemplateDetail(idOrSlug: { id?: string; slug?: string }) {
  const path = idOrSlug.slug
    ? `/admin/content/interview-templates/by-slug/${encodeURIComponent(idOrSlug.slug)}/detail`
    : `/admin/content/interview-templates/${encodeURIComponent(idOrSlug.id ?? '')}/detail`
  return api<{ template: AdminInterviewTemplate; sections: AdminTemplateSection[] }>(path)
}

export function upsertAdminInterviewTemplate(body: {
  id?: string
  company_id?: string
  slug: string
  title: string
  description?: string
  target_role?: string
  target_level?: string
  passing_score: number
  is_active: boolean
}) {
  return api<{ template: AdminInterviewTemplate }>('/admin/content/interview-templates', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function replaceAdminTemplateStructure(
  templateId: string,
  sections: Array<{
    id?: string
    section_type: string
    title: string
    description?: string
    position: number
    passing_score?: number
    task_ids: string[]
  }>,
) {
  return api<{ template: AdminInterviewTemplate; sections: AdminTemplateSection[] }>(
    `/admin/content/interview-templates/${encodeURIComponent(templateId)}/structure`,
    {
      method: 'POST',
      body: JSON.stringify({ template_id: templateId, sections }),
    },
  )
}

export interface AdminPlan {
  slug: string
  name: string
  tagline: string
  highlight: boolean
  highlights: string[]
  features: Record<string, boolean>
  limits?: Record<string, AdminPlanEntitlementSpec>
}

export interface AdminPlanEntitlementSpec {
  type: string
  limit?: number
  unlimited?: boolean
  period?: string
  value?: boolean
}

export interface AdminUsageLimit {
  used: number
  limit?: number
  remaining?: number
  unlimited: boolean
}

export interface AdminUserEntitlements {
  user_id: string
  plan_slug: string
  plan_name: string
  features: Record<string, boolean>
  limits: Record<string, AdminUsageLimit>
}

export function listAdminPlans() {
  return api<{ plans: AdminPlan[] }>('/admin/billing/plans')
}

export function getAdminUserEntitlements(userId: string) {
  return api<{ entitlements: AdminUserEntitlements }>(
    `/admin/billing/users/${encodeURIComponent(userId)}/entitlements`,
  )
}

export function grantAdminSubscription(body: {
  user_id: string
  plan_slug: string
  current_period_end?: string
}) {
  return api<{ subscription_id: string; plan_slug: string; status: string }>(
    '/admin/billing/subscriptions/grant',
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function revokeAdminSubscription(userId: string) {
  return api<{ revoked: boolean }>('/admin/billing/subscriptions/revoke', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })
}

export function updateAdminPlanEntitlement(
  planSlug: string,
  key: string,
  spec: AdminPlanEntitlementSpec,
) {
  return api<{ plan_slug: string; key: string; spec: AdminPlanEntitlementSpec }>(
    `/admin/billing/plans/${encodeURIComponent(planSlug)}/entitlements/${encodeURIComponent(key)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ spec }),
    },
  )
}

export type AdminEvaluationJobStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AdminEvaluationJob {
  id: string
  attempt_id: string
  user_id: string
  task_id: string
  status: AdminEvaluationJobStatus
  retry_count: number
  retryable: boolean
  error?: string
}

export interface AdminLLMConfig {
  version: number
  chain_order: string[]
  task_map_json?: string
  virtual_chains_json?: string
}

export function listAdminEvaluationJobs(params?: { status?: AdminEvaluationJobStatus; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status.toUpperCase())
  if (params?.limit != null) qs.set('limit', String(params.limit))
  const q = qs.toString()
  return api<{ jobs: AdminEvaluationJob[] }>(`/admin/ai/evaluation-jobs${q ? `?${q}` : ''}`)
}

export function getAdminLLMConfig() {
  return api<{ config: AdminLLMConfig }>('/admin/ai/llm/config')
}

export function updateAdminLLMConfig(body: {
  expected_version: number
  chain_order: string[]
  task_map_json?: string
  virtual_chains_json?: string
}) {
  return api<{ config: AdminLLMConfig }>('/admin/ai/llm/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export interface AdminLLMProviderProbe {
  provider: string
  model: string
  registered: boolean
  ok: boolean
  latency_ms: number
  error?: string
}

export function probeAdminLLMProviders() {
  return api<{ probes: AdminLLMProviderProbe[] }>('/admin/ai/llm/probe', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
