import { api } from '@/lib/apiClient'
import type { Company, InterviewTemplate, Task, TemplateSection } from '@/lib/types'

export function listCompanies(activeOnly = true) {
  const q = activeOnly ? '?active_only=true' : ''
  return api<{ companies: Company[] }>(`/companies${q}`)
}

export function listInterviewTemplates(companyId?: string, activeOnly = true) {
  const params = new URLSearchParams()
  if (companyId) params.set('company_id', companyId)
  if (activeOnly) params.set('active_only', 'true')
  const q = params.toString()
  return api<{ templates: InterviewTemplate[] }>(`/interview-templates${q ? `?${q}` : ''}`)
}

export function getInterviewTemplateDetail(id: string) {
  return api<{ template: InterviewTemplate; sections: TemplateSection[] }>(
    `/interview-templates/${id}/detail`,
  )
}

export function getTask(id: string) {
  return api<{ task: Task }>(`/tasks/${id}`)
}
