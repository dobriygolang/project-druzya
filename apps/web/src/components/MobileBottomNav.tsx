import { Home, Sparkles, User } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'

const TABS: Array<{
  to: string
  icon: typeof Home
  label: string
  primary?: boolean
}> = [
  { to: '/dashboard', icon: Home, label: 'Главная' },
  { to: '/interview', icon: Sparkles, label: 'Mock', primary: true },
  { to: '/profile', icon: User, label: 'Профиль' },
]

const HIDE_ON: RegExp[] = [
  /^\/login$/,
  /^\/welcome(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/interview\/session\//,
  /^\/live\//,
]

export function MobileBottomNav() {
  const { pathname } = useLocation()
  if (HIDE_ON.some((re) => re.test(pathname))) return null

  return (
    <nav
      role="navigation"
      aria-label="Мобильная навигация"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur sm:hidden',
        'supports-[backdrop-filter]:bg-bg/80',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="grid grid-cols-3 items-center pt-2 pb-1.5">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'relative flex flex-col items-center gap-0.5 py-1 select-none transition-transform duration-[var(--motion-dur-small)]',
                'active:scale-[0.92]',
                isActive ? 'text-text-primary' : 'text-text-muted',
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'relative grid place-items-center',
                    tab.primary &&
                      ' -mt-3 h-11 w-11 rounded-full border border-border-strong bg-surface-2',
                  )}
                >
                  <tab.icon
                    className={tab.primary ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'}
                    strokeWidth={tab.primary ? 2.2 : 2}
                  />
                </div>
                <span
                  className={cn(
                    'font-mono text-[9px] uppercase tracking-[0.08em]',
                    isActive && 'font-semibold',
                  )}
                >
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
