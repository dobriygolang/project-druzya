import { api } from '@/lib/apiClient'
import { asArray, normalizeDashboard } from '@/lib/api/normalize'
import type { Dashboard, MockHubContext } from '@/lib/types'

export function getDashboard() {
  return api<Dashboard>('/recommendations/dashboard').then(normalizeDashboard)
}

export function getMockHubContext() {
  return api<{
    stale_modes?: MockHubContext['stale_modes']
    template_progress?: MockHubContext['template_progress']
    task_type_coverage?: MockHubContext['task_type_coverage']
  }>('/recommendations/mock-hub').then(
    (raw): MockHubContext => ({
      stale_modes: asArray(raw.stale_modes),
      template_progress: asArray(raw.template_progress),
      task_type_coverage: asArray(raw.task_type_coverage),
    }),
  )
}

export function dismissRecommendation(id: string) {
  return api(`/recommendations/${id}/dismiss`, { method: 'POST', body: '{}' })
}

export function completeRecommendation(id: string) {
  return api(`/recommendations/${id}/complete`, { method: 'POST', body: '{}' })
}

export function markArticleRead(slug: string) {
  return api<{ slug: string; read_at?: string }>(
    `/recommendations/articles/${encodeURIComponent(slug)}/read`,
    { method: 'POST', body: '{}' },
  )
}
