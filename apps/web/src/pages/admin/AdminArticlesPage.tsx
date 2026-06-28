import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { listAdminArticles, type AdminArticleStatus } from '@/lib/api/admin'

const STATUS_OPTIONS: { value: AdminArticleStatus; label: string }[] = [
  { value: 'ARTICLE_STATUS_DRAFT', label: 'draft' },
  { value: 'ARTICLE_STATUS_PUBLISHED', label: 'published' },
  { value: 'ARTICLE_STATUS_ARCHIVED', label: 'archived' },
]

function statusLabel(status: AdminArticleStatus) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}

export default function AdminArticlesPage() {
  const listQ = useQuery({
    queryKey: ['admin-articles'],
    queryFn: () => listAdminArticles({ limit: 100 }),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Articles</h2>
        <Link to="/admin/articles/new">
          <Button size="sm">New article</Button>
        </Link>
      </div>

      <Card elevation="e1" className="p-4">
        {listQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        <ul className="space-y-2 text-sm">
          {(listQ.data?.articles ?? []).map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-border px-3 py-2">
              <div>
                <div className="font-medium">{a.title}</div>
                <div className="text-text-muted">
                  {a.slug} · {statusLabel(a.status)}
                  {a.videos?.length ? ` · ${a.videos.length} video(s)` : ''}
                </div>
                {a.skill_keys?.length ? (
                  <div className="mt-1 font-mono text-[11px] text-text-secondary">
                    {a.skill_keys.join(', ')}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <Link
                  to={`/admin/articles/${encodeURIComponent(a.slug)}/edit`}
                  className="text-sm text-accent no-underline hover:underline"
                >
                  Edit
                </Link>
                <Link
                  to={`/learn/${encodeURIComponent(a.slug)}?preview=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-text-muted no-underline hover:underline"
                >
                  Preview
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
