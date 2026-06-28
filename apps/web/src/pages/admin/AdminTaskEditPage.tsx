import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DifficultySelect,
  TaskStatusSelect,
  TaskTypeSelect,
} from '@/components/admin/FormControls'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CODE_LANGUAGES, inputClassName, labelClassName } from '@/lib/admin/options'
import {
  getAdminTask,
  replaceAdminTaskSolutions,
  upsertAdminTask,
  type AdminTaskSolution,
} from '@/lib/api/admin'
import { enumsEn } from '@/lib/labels/enums.en'

type SolutionDraft = {
  id?: string
  language: string
  solution_text: string
  explanation: string
  complexity: string
  is_primary: boolean
}

function emptySolution(primary = false): SolutionDraft {
  return {
    language: '',
    solution_text: '',
    explanation: '',
    complexity: '',
    is_primary: primary,
  }
}

function solutionToDraft(sol: AdminTaskSolution): SolutionDraft {
  return {
    id: sol.id,
    language: sol.language ?? '',
    solution_text: sol.solution_text,
    explanation: sol.explanation ?? '',
    complexity: sol.complexity ?? '',
    is_primary: sol.is_primary,
  }
}

export default function AdminTaskEditPage() {
  const { slug: routeSlug = 'new' } = useParams()
  const isNew = routeSlug === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [id, setId] = useState<string>()
  const [slug, setSlug] = useState('')
  const [type, setType] = useState('algorithm')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [status, setStatus] = useState('draft')
  const [estimatedMinutes, setEstimatedMinutes] = useState('')
  const [solutions, setSolutions] = useState<SolutionDraft[]>([])

  const taskQ = useQuery({
    queryKey: ['admin-task', routeSlug],
    queryFn: () => getAdminTask({ slug: routeSlug }),
    enabled: !isNew,
  })

  useEffect(() => {
    const task = taskQ.data?.task
    if (!task) return
    setId(task.id)
    setSlug(task.slug)
    setType(task.type)
    setTitle(task.title)
    setDescription(task.description)
    setDifficulty(task.difficulty || 'medium')
    setStatus(task.status)
    setEstimatedMinutes(task.estimated_minutes != null ? String(task.estimated_minutes) : '')
    const loaded = (taskQ.data?.solutions ?? []).map(solutionToDraft)
    setSolutions(loaded.length > 0 ? loaded : [emptySolution(true)])
  }, [taskQ.data])

  useEffect(() => {
    if (isNew && solutions.length === 0) {
      setSolutions([emptySolution(true)])
    }
  }, [isNew, solutions.length])

  const saveM = useMutation({
    mutationFn: async () => {
      const taskRes = await upsertAdminTask({
        id,
        slug,
        type,
        title,
        description,
        difficulty,
        status,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : undefined,
      })
      const taskId = taskRes.task.id
      const validSolutions = solutions
        .filter((s) => s.solution_text.trim())
        .map((s) => ({
          id: s.id,
          language: s.language.trim() || undefined,
          solution_text: s.solution_text.trim(),
          explanation: s.explanation.trim() || undefined,
          complexity: s.complexity.trim() || undefined,
          is_primary: s.is_primary,
        }))
      if (validSolutions.length > 0) {
        const primaryCount = validSolutions.filter((s) => s.is_primary).length
        if (primaryCount === 0) {
          validSolutions[0].is_primary = true
        }
        await replaceAdminTaskSolutions(taskId, validSolutions)
      } else if (!isNew && taskId) {
        await replaceAdminTaskSolutions(taskId, [])
      }
      return taskRes
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['admin-tasks'] })
      void qc.invalidateQueries({ queryKey: ['admin-task', res.task.slug] })
      if (isNew) {
        navigate(`/admin/tasks/${encodeURIComponent(res.task.slug)}/edit`, { replace: true })
      }
    },
  })

  function setPrimary(index: number) {
    setSolutions((prev) =>
      prev.map((item, i) => ({ ...item, is_primary: i === index })),
    )
  }

  function updateSolution(index: number, patch: Partial<SolutionDraft>) {
    setSolutions((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  if (!isNew && taskQ.isLoading) {
    return <p className="text-sm text-text-muted">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">{isNew ? 'New task' : `Edit: ${slug}`}</h2>
        <Link to="/admin/tasks" className="text-sm text-text-muted no-underline hover:text-text-primary">
          ← Back to list
        </Link>
      </div>

      <Card elevation="e1" className="space-y-3 p-4">
        <h3 className="font-medium">Task</h3>
        <label className={labelClassName}>
          Slug
          <input
            className={inputClassName}
            value={slug}
            disabled={!isNew && !!id}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <TaskTypeSelect value={type} onChange={setType} />
        <label className={labelClassName}>
          Title
          <input className={inputClassName} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={labelClassName}>
          Description
          <textarea
            className={inputClassName}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <DifficultySelect value={difficulty} onChange={setDifficulty} />
          <TaskStatusSelect value={status} onChange={setStatus} />
          <label className={labelClassName}>
            Est. minutes
            <input
              type="number"
              min={1}
              className={inputClassName}
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card elevation="e1" className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium">Reference solutions</h3>
            <p className="text-xs text-text-muted">
              Used by AI to compare the candidate answer with expected solutions. At least one primary solution
              recommended.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setSolutions((prev) => [...prev, emptySolution()])}>
            Add solution
          </Button>
        </div>

        {solutions.map((sol, index) => (
          <div key={index} className="space-y-2 rounded border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Solution {index + 1}</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name="primary-solution"
                    checked={sol.is_primary}
                    onChange={() => setPrimary(index)}
                  />
                  Primary
                </label>
                {solutions.length > 1 ? (
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary"
                    onClick={() => setSolutions((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <label className={labelClassName}>
              Language
              <select
                className={inputClassName}
                value={sol.language}
                onChange={(e) => updateSolution(index, { language: e.target.value })}
              >
                {CODE_LANGUAGES.map((lang) => (
                  <option key={lang.value || 'none'} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClassName}>
              Solution text
              <textarea
                className={`${inputClassName} font-mono`}
                rows={8}
                placeholder={
                  type === 'behavioral'
                    ? 'Example STAR answer or talking points…'
                    : 'Reference code or prose answer…'
                }
                value={sol.solution_text}
                onChange={(e) => updateSolution(index, { solution_text: e.target.value })}
              />
            </label>
            <label className={labelClassName}>
              Explanation (optional)
              <textarea
                className={inputClassName}
                rows={2}
                value={sol.explanation}
                onChange={(e) => updateSolution(index, { explanation: e.target.value })}
              />
            </label>
            <label className={labelClassName}>
              Complexity (optional)
              <input
                className={inputClassName}
                placeholder="O(n) time, O(n) space"
                value={sol.complexity}
                onChange={(e) => updateSolution(index, { complexity: e.target.value })}
              />
            </label>
          </div>
        ))}
      </Card>

      <div className="flex gap-2">
        <Button
          loading={saveM.isPending}
          disabled={!slug || !title || !type}
          onClick={() => saveM.mutate()}
        >
          Save task & solutions
        </Button>
        {saveM.isError ? (
          <p className="self-center text-sm text-red-500">
            {saveM.error instanceof Error ? saveM.error.message : 'Save failed'}
          </p>
        ) : null}
      </div>

      {!isNew && type ? (
        <p className="text-xs text-text-muted">
          Rubric for {(enumsEn.taskType as Record<string, string>)[type] ?? type} is applied automatically from the active catalog rubric.
        </p>
      ) : null}
    </div>
  )
}
