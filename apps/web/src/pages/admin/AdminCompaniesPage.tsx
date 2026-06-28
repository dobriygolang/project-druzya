import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { listAdminCompanies, upsertAdminCompany } from '@/lib/api/admin'

export default function AdminCompaniesPage() {
  const qc = useQueryClient()
  const [slug, setSlug] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const listQ = useQuery({
    queryKey: ['admin-companies'],
    queryFn: () => listAdminCompanies({ limit: 100 }),
  })

  const saveM = useMutation({
    mutationFn: () =>
      upsertAdminCompany({
        slug,
        name,
        description: description || undefined,
        is_active: true,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-companies'] })
      setSlug('')
      setName('')
      setDescription('')
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card elevation="e1" className="space-y-3 p-4">
        <h2 className="font-medium">New company</h2>
        <label className="block text-sm">
          Slug
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Name
          <input
            className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        <Button
          loading={saveM.isPending}
          disabled={!slug || !name}
          onClick={() => saveM.mutate()}
        >
          Save
        </Button>
        {saveM.isError ? (
          <p className="text-sm text-red-500">
            {saveM.error instanceof Error ? saveM.error.message : 'Save failed'}
          </p>
        ) : null}
      </Card>

      <Card elevation="e1" className="p-4">
        <h2 className="mb-3 font-medium">Companies</h2>
        {listQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        {listQ.isError ? <p className="text-sm text-red-500">Failed to load</p> : null}
        <ul className="space-y-2 text-sm">
          {(listQ.data?.companies ?? []).map((c) => (
            <li key={c.id} className="rounded border border-border px-3 py-2">
              <div className="font-medium">{c.name}</div>
              <div className="text-text-muted">
                {c.slug} · {c.is_active ? 'active' : 'inactive'}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
