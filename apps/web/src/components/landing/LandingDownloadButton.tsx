import { cn } from '@/lib/cn'
import { useLandingDownload } from '@/lib/landing/useLandingDownload'
import { useI18n } from '@/lib/i18n'

type Props = {
  compact?: boolean
  className?: string
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </svg>
  )
}

export function LandingDownloadButton({ compact, className }: Props) {
  const { preparing, label, onDownload } = useLandingDownload()

  return (
    <button
      type="button"
      disabled={preparing}
      onClick={onDownload}
      className={cn(
        'group relative inline-flex items-center justify-center overflow-hidden rounded-md bg-winter-accent font-medium text-black shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all duration-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-winter-bg disabled:pointer-events-none disabled:opacity-50',
        compact ? 'h-9 px-4 py-2 text-sm' : 'px-6 py-3 text-sm',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {!compact ? <DownloadIcon className="relative z-10 mr-2 fill-white" /> : null}
      <span className="relative z-10">{label}</span>
    </button>
  )
}

export function LandingDownloadToast() {
  const { t } = useI18n()
  const { downloaded } = useLandingDownload()

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-6 right-6 z-50 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs text-white/80 shadow-lg backdrop-blur-md transition-all duration-300',
        downloaded ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
      )}
    >
      {t('welcome.downloadStarted')}
    </div>
  )
}
