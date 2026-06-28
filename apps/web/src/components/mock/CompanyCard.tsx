import { brand } from '@/lib/brand/tokens'
import { cn } from '@/lib/cn'

export type CompanyCardProps = {
  id: string
  name: string
  slug?: string
  description?: string
  onSelect: (companyId: string) => void
  loading?: boolean
  selected?: boolean
}

function Initials({ name }: { name: string }) {
  const parts = (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
  const txt = parts.map((p) => p[0]?.toUpperCase() ?? '').join('')
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-2 text-sm font-semibold text-text-secondary">
      {txt || '?'}
    </div>
  )
}

export function CompanyCard({
  id,
  name,
  slug,
  description,
  onSelect,
  loading,
  selected,
}: CompanyCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      disabled={loading}
      className={cn(
        'card-lift group relative flex flex-col gap-3 rounded-2xl border bg-surface-1 p-4 text-left',
        selected ? 'border-border-strong shadow-card' : 'border-border hover:border-border-strong',
        'disabled:cursor-wait disabled:opacity-60',
      )}
    >
      {selected ? (
        <span
          className="absolute bottom-3 left-0 top-3 w-0.5 rounded-r"
          style={{ background: brand.dot }}
          aria-hidden
        />
      ) : null}
      <div className="flex items-center gap-3 pl-0.5">
        <Initials name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-text-primary">{name}</div>
          {slug ? (
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
              {slug}
            </div>
          ) : null}
        </div>
      </div>
      {description ? (
        <p className="line-clamp-2 pl-0.5 text-[13px] leading-relaxed text-text-secondary">
          {description}
        </p>
      ) : null}
    </button>
  )
}
