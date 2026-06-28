import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { listAdminTasks } from '@/lib/api/admin'
import { enumsEn } from '@/lib/labels/enums.en'

export default function AdminTasksPage() {
  const listQ = useQuery({
    queryKey: ['admin-tasks'],
    queryFn: () => listAdminTasks({ limit: 100, status: '' }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Tasks</h2>
        <Link to="/admin/tasks/new/edit">
          <Button>New task</Button>
        </Link>
      </div>

      <Card elevation="e1" className="p-4">
        {listQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        <ul className="space-y-2 text-sm">
          {(listQ.data?.tasks ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2">
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-text-muted">
                  {t.slug} · {(enumsEn.taskType as Record<string, string>)[t.type] ?? t.type} ·{' '}
                  {(enumsEn.difficulty as Record<string, string>)[t.difficulty] ?? t.difficulty} · {t.status}
                </div>
              </div>
              <Link
                to={`/admin/tasks/${encodeURIComponent(t.slug)}/edit`}
                className="shrink-0 text-sm text-text-secondary underline"
              >
                Edit
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
