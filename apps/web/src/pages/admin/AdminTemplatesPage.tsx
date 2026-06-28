import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { listAdminInterviewTemplates, upsertAdminInterviewTemplate } from '@/lib/api/admin'

export default function AdminTemplatesPage() {
  const qc = useQueryClient()
  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [passingScore, setPassingScore] = useState('85')

  const listQ = useQuery({
    queryKey: ['admin-templates'],
    queryFn: () => listAdminInterviewTemplates({ limit: 100 }),
  })

  const saveM = useMutation({
    mutationFn: () =>
      upsertAdminInterviewTemplate({
        slug,
        title,
        description: description || undefined,
        target_role: targetRole || undefined,
        passing_score: Number(passingScore) || 85,
        is_active: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-templates'] })
      setSlug('')
      setTitle('')
      setDescription('')
      setTargetRole('')
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card elevation="e1" className="space-y-3 p-4">
        <h2 className="font-medium">New template</h2>
        <label className="block text-sm">
          Slug
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Title
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Target role
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Description
          <textarea
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Passing score
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={passingScore}
            onChange={(e) => setPassingScore(e.target.value)}
          />
        </label>
        <Button
          loading={saveM.isPending}
          disabled={!slug || !title}
          onClick={() => saveM.mutate()}
        >
          Save
        </Button>
      </Card>

      <Card elevation="e1" className="p-4">
        <h2 className="mb-3 font-medium">Templates</h2>
        {listQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        <ul className="space-y-2 text-sm">
          {(listQ.data?.templates ?? []).map((t) => (
            <li key={t.id} className="rounded border border-border px-3 py-2">
              <Link to={`/admin/templates/${t.id}`} className="font-medium hover:underline">
                {t.title}
              </Link>
              <div className="text-text-muted">
                {t.slug} · score {t.passing_score} · {t.is_active ? 'active' : 'inactive'}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
