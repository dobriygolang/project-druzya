import { api } from '@/lib/apiClient'
import { asArray } from '@/lib/api/normalize'
import type { Company, InterviewTemplate, Task, TemplateSection } from '@/lib/types'

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
