import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { listAdminTasks, upsertAdminTask } from '@/lib/api/admin'

export default function AdminTasksPage() {
  const qc = useQueryClient()
  const [slug, setSlug] = useState('')
  const [type, setType] = useState('algorithm')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('draft')

  const listQ = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: () => listAdminTasks({ limit: 100, status: '' }),
  })

  const saveM = useMutation({
    mutationFn: () =>
      upsertAdminTask({
        slug,
        type,
        title,
        description,
        difficulty: 'medium',
        status,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-tasks'] })
      setSlug('')
      setTitle('')
      setDescription('')
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card elevation="e1" className="space-y-3 p-4">
        <h2 className="font-medium">New task</h2>
        <label className="block text-sm">
          Slug
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Type
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
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
          Description
          <textarea
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Status
          <select
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <Button
          loading={saveM.isPending}
          disabled={!slug || !title || !type}
          onClick={() => saveM.mutate()}
        >
          Save
        </Button>
      </Card>

      <Card elevation="e1" className="p-4">
        <h2 className="mb-3 font-medium">Tasks</h2>
        {listQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        <ul className="space-y-2 text-sm">
          {(listQ.data?.tasks ?? []).map((t) => (
            <li key={t.id} className="rounded border border-border px-3 py-2">
              <div className="font-medium">{t.title}</div>
              <div className="text-text-muted">
                {t.slug} · {t.type} · {t.status}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
