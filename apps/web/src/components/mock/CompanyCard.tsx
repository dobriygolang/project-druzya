import { cn } from '@/lib/cn'

export type CompanyCardProps = {
  id: string
  name: string
  slug?: string
  description?: string
  onSelect: (companyId: string) => void
  loading?: boolean
}

function Initials({ name }: { name: string }) {
  const parts = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
  const txt = parts.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-surface-2 font-display text-base font-bold text-text-secondary">
      {txt || '?'}
    </div>
  )
}

export function CompanyCard({ id, name, slug, description, onSelect, loading }: CompanyCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      disabled={loading}
      className={cn(
        'card-lift group relative flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-4 text-left',
        'hover:border-border-strong hover:bg-surface-2',
        'disabled:cursor-wait disabled:opacity-60',
      )}
    >
      <div className="flex items-center gap-3">
        <Initials name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-bold text-text-primary">{name}</div>
          {slug ? (
            <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {slug}
            </div>
          ) : null}
        </div>
      </div>
      {description ? (
        <p className="line-clamp-2 text-xs text-text-secondary">{description}</p>
      ) : null}
    </button>
  )
}
