import { Link } from 'react-router-dom'
import { Construction } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageContent } from '@/components/PageContent'

type FeatureUnavailableProps = {
  /** Page title shown in the stub */
  title: string
  /** Why the feature is unavailable */
  reason: string
  /** Missing backend RPCs (shown as list) */
  backend?: string[]
  /** Legacy source path for developers */
  legacySource?: string
  /** Optional tracking note / ticket */
  trackingNote?: string
}

export function FeatureUnavailable({
  title,
  reason,
  backend = [],
  legacySource,
  trackingNote,
}: FeatureUnavailableProps) {
  return (
    <PageContent className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-surface-2">
        <Construction className="h-7 w-7 text-text-secondary" aria-hidden />
      </div>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-text-secondary">{reason}</p>

      {backend.length > 0 ? (
        <div className="mt-6 w-full max-w-md rounded-lg border border-border bg-surface-1 px-4 py-3 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Ожидаемые RPC
          </p>
          <ul className="mt-2 space-y-1 font-mono text-xs text-text-primary">
            {backend.map((rpc) => (
              <li key={rpc}>{rpc}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {import.meta.env.DEV && (legacySource || trackingNote) ? (
        <div className="mt-4 max-w-md text-left font-mono text-[11px] text-text-secondary">
          {legacySource ? <p>legacy: {legacySource}</p> : null}
          {trackingNote ? <p className="mt-1">{trackingNote}</p> : null}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link to="/today">
          <Button variant="secondary">На главную</Button>
        </Link>
        {import.meta.env.DEV ? (
          <Link to="/migration">
            <Button variant="ghost">Migration dashboard</Button>
          </Link>
        ) : null}
      </div>
    </PageContent>
  )
}
