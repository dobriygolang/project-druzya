import { api } from '@/lib/apiClient'
import type { Dashboard } from '@/lib/types'

function normalizeDashboard(raw: Dashboard): Dashboard {
  return {
    readiness_score: raw.readiness_score ?? 0,
    pending_retry_count: raw.pending_retry_count ?? 0,
    profile_summary: raw.profile_summary,
    strengths: raw.strengths ?? [],
    weaknesses: raw.weaknesses ?? [],
    recommendations: raw.recommendations ?? [],
    learning_plan: raw.learning_plan ?? [],
  }
}

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
