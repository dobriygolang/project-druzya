import { api } from '@/lib/apiClient'
import { normalizeDashboard } from '@/lib/api/normalize'
import type { Dashboard } from '@/lib/types'

export function getDashboard() {
  return api<Dashboard>('/recommendations/dashboard').then(normalizeDashboard)
}

export function dismissRecommendation(id: string) {
  return api(`/recommendations/${id}/dismiss`, { method: 'POST', body: '{}' })
}

export function completeRecommendation(id: string) {
  return api(`/recommendations/${id}/complete`, { method: 'POST', body: '{}' })
}

export function completeLearningPlanItem(id: string) {
  return api(`/recommendations/learning-plan/${id}/complete`, { method: 'POST', body: '{}' })
}

export function dismissLearningPlanItem(id: string) {
  return api(`/recommendations/learning-plan/${id}/dismiss`, { method: 'POST', body: '{}' })
}

export function markArticleRead(slug: string) {
  return api<{ slug: string; read_at?: string }>(
    `/recommendations/articles/${encodeURIComponent(slug)}/read`,
    { method: 'POST', body: '{}' },
  )
}
