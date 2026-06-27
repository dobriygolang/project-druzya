import { api } from '@/lib/apiClient'
import type { Dashboard } from '@/lib/types'

export function getDashboard() {
  return api<Dashboard>('/recommendations/dashboard')
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
