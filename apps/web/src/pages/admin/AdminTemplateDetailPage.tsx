import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CheckboxMultiSelect, TaskTypeSelect } from '@/components/admin/FormControls'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { inputClassName, labelClassName } from '@/lib/admin/options'
import {
  getAdminInterviewTemplateDetail,
  listAdminTasks,
  replaceAdminTemplateStructure,
  upsertAdminInterviewTemplate,
  type AdminTemplateSection,
} from '@/lib/api/admin'

type SectionDraft = {
  section_type: string
  title: string
  description: string
  position: number
  passing_score: string
  task_ids: string[]
}

function sectionToDraft(sec: AdminTemplateSection, index: number): SectionDraft {
  return {
    section_type: sec.section_type,
    title: sec.title,
    description: sec.description ?? '',
    position: sec.position || index + 1,
    passing_score: sec.passing_score != null ? String(sec.passing_score) : '',
    task_ids: sec.task_ids,
  }
}

export default function AdminTemplateDetailPage() {
  const { templateId = '' } = useParams()
  const qc = useQueryClient()

  const detailQ = useQuery({
    queryKey: ['admin-template', templateId],
    queryFn: () => getAdminInterviewTemplateDetail({ id: templateId }),
    enabled: Boolean(templateId),
  })

  const tasksQ = useQuery({
    queryKey: ['admin-tasks-for-template'],
    queryFn: () => listAdminTasks({ limit: 200, status: 'published' }),
  })

  const taskOptions = (tasksQ.data?.tasks ?? []).map((t) => ({
    value: t.id,
    label: `${t.title} (${t.slug})`,
  }))

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [passingScore, setPassingScore] = useState('85')
  const [isActive, setIsActive] = useState(true)
  const [sections, setSections] = useState<SectionDraft[]>([])

  useEffect(() => {
    const t = detailQ.data?.template
    if (!t) return
    setTitle(t.title)
    setSlug(t.slug)
    setDescription(t.description ?? '')
    setTargetRole(t.target_role ?? '')
    setPassingScore(String(t.passing_score))
    setIsActive(t.is_active)
    setSections((detailQ.data?.sections ?? []).map(sectionToDraft))
  }, [detailQ.data])

  const saveMetaM = useMutation({
    mutationFn: () =>
      upsertAdminInterviewTemplate({
        id: templateId,
        slug,
        title,
        description: description || undefined,
        target_role: targetRole || undefined,
        passing_score: Number(passingScore) || 85,
        is_active: isActive,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-template', templateId] })
      void qc.invalidateQueries({ queryKey: ['admin-templates'] })
    },
  })

  const saveStructureM = useMutation({
    mutationFn: () =>
      replaceAdminTemplateStructure(
        templateId,
        sections.map((sec, idx) => ({
          section_type: sec.section_type,
          title: sec.title,
          description: sec.description || undefined,
          position: sec.position || idx + 1,
          passing_score: sec.passing_score ? Number(sec.passing_score) : undefined,
          task_ids: sec.task_ids,
        })),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-template', templateId] })
    },
  })

  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        section_type: 'algorithm',
        title: '',
        description: '',
        position: prev.length + 1,
        passing_score: '',
        task_ids: [],
      },
    ])
  }

  if (detailQ.isLoading) {
    return <p className="text-sm text-text-muted">Loading template…</p>
  }

  if (detailQ.isError || !detailQ.data?.template) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-red-500">Failed to load template.</p>
        <Link to="/admin/templates" className="text-text-secondary underline">
          Back to templates
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/templates" className="text-sm text-text-muted hover:text-text-primary">
        ← Templates
      </Link>

      <Card elevation="e1" className="space-y-3 p-4">
        <h2 className="font-medium">Template metadata</h2>
        <label className={labelClassName}>
          Slug
          <input className={inputClassName} value={slug} onChange={(e) => setSlug(e.target.value)} />
        </label>
        <label className={labelClassName}>
          Title
          <input className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={labelClassName}>
          Target role
          <input className={inputClassName} value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
        </label>
        <label className={labelClassName}>
          Description
          <textarea
            className={inputClassName}
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className={labelClassName}>
            Passing score
            <input
              className="mt-1 w-24 rounded border border-border bg-surface-1 px-3 py-2 text-sm"
              value={passingScore}
              onChange={(e) => setPassingScore(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active
          </label>
        </div>
        <Button loading={saveMetaM.isPending} onClick={() => saveMetaM.mutate()}>
          Save metadata
        </Button>
      </Card>

      <Card elevation="e1" className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Sections</h2>
          <Button variant="secondary" onClick={addSection}>
            Add section
          </Button>
        </div>

        {sections.map((sec, idx) => (
          <div key={idx} className="space-y-2 rounded border border-border p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <TaskTypeSelect
                label="Section type"
                value={sec.section_type}
                onChange={(value) =>
                  setSections((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, section_type: value } : item)),
                  )
                }
              />
              <label className={labelClassName}>
                Position
                <input
                  className={inputClassName}
                  value={sec.position}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, position: Number(e.target.value) || 0 } : item,
                      ),
                    )
                  }
                />
              </label>
            </div>
            <label className={labelClassName}>
              Title
              <input
                className={inputClassName}
                value={sec.title}
                onChange={(e) =>
                  setSections((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, title: e.target.value } : item)),
                  )
                }
              />
            </label>
            <CheckboxMultiSelect
              label="Tasks in this section"
              options={taskOptions}
              selected={sec.task_ids}
              emptyHint="No published tasks — publish tasks first."
              onChange={(task_ids) =>
                setSections((prev) =>
                  prev.map((item, i) => (i === idx ? { ...item, task_ids } : item)),
                )
              }
            />
          </div>
        ))}

        <Button loading={saveStructureM.isPending} onClick={() => saveStructureM.mutate()}>
          Save structure
        </Button>
        {saveStructureM.isError ? (
          <p className="text-sm text-red-500">
            {saveStructureM.error instanceof Error ? saveStructureM.error.message : 'Save failed'}
          </p>
        ) : null}
      </Card>
    </div>
  )
}
