import { useEffect, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/cn'
import { readAccessToken } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'

type Props = {
  heroSentinelRef?: RefObject<HTMLDivElement>
}

export function LandingNav({ heroSentinelRef }: Props) {
  const { t } = useI18n()
  const isAuthed = !!readAccessToken()
  const [onLight, setOnLight] = useState(false)

  useEffect(() => {
    const target = heroSentinelRef?.current
    if (!target) return
    const observer = new IntersectionObserver(
      ([entry]) => setOnLight(!entry?.isIntersecting),
      { rootMargin: '-72px 0px 0px 0px', threshold: 0 },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [heroSentinelRef])

  const linkClass = cn(
    'text-sm no-underline transition-colors',
    onLight ? 'text-text-secondary hover:text-text-primary' : 'text-white/60 hover:text-white',
  )

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-500',
        onLight
          ? 'border-border/80 bg-bg/90 backdrop-blur-md'
          : 'border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md',
      )}
    >
      <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-4 px-6 py-4 sm:px-8">
        <Logo to="/welcome" tone={onLight ? 'light' : 'dark'} />

        <nav className="hidden items-center gap-7 md:flex">
          <a href="#philosophy" className={linkClass}>
            {t('welcome.navPhilosophy')}
          </a>
          <a href="#features" className={linkClass}>
            {t('public.features')}
          </a>
          <Link to="/live/new" className={linkClass}>
            {t('public.liveCoding')}
          </Link>
          <a href="#pricing" className={linkClass}>
            {t('public.pricing')}
          </a>
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <LocaleSwitcher
            compact
            className={cn('hidden sm:flex', onLight ? '' : '[&_button]:text-white/70 [&_button:hover]:text-white')}
          />
          <Link
            to={isAuthed ? '/profile' : '/login'}
            className={cn(
              'rounded-lg px-3.5 py-2 text-sm font-medium no-underline transition-colors',
              onLight ? 'bg-text-primary text-bg' : 'bg-white text-[#0a0a0a] hover:bg-white/90',
            )}
          >
            {isAuthed ? t('public.account') : t('welcome.navDownload')}
          </Link>
        </div>
      </div>
    </header>
  )
}
