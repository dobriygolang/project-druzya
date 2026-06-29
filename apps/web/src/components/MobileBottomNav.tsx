import { NavLink, useLocation } from 'react-router-dom'
import { Home, Sparkles, User } from 'lucide-react'
import { useMobileNav } from '@/lib/migration/nav'
import { cn } from '@/lib/cn'

const TAB_ICONS: Record<string, typeof Home> = {
  '/today': Home,
  '/mock': Sparkles,
  '/profile': User,
}

const HIDE_ON: RegExp[] = [
  /^\/onboarding(\/|$)/,
  /^\/auth(\/|$)/,
  /^\/login$/,
  /^\/welcome(\/|$)/,
  /^\/interview\/session\//,
  /^\/live\//,
]

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const mobileNav = useMobileNav()
  if (HIDE_ON.some((re) => re.test(pathname))) return null
  if (mobileNav.length === 0) return null

  return (
    <nav
      role="navigation"
      aria-label="Mobile bottom navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 backdrop-blur sm:hidden',
        'supports-[backdrop-filter]:bg-bg/90',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="grid items-center pt-2 pb-1.5"
        style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}
      >
        {mobileNav.map((tab) => {
          const Icon = TAB_ICONS[tab.to] ?? Home
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/today'}
              aria-label={tab.label}
              onClick={() => {
                if ('vibrate' in navigator) {
                  try {
                    navigator.vibrate(8)
                  } catch {
                    /* noop */
                  }
                }
              }}
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
                        '-mt-3 h-11 w-11 rounded-xl border border-border bg-surface-1 shadow-card',
                    )}
                  >
                    <Icon
                      className={tab.primary ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'}
                      strokeWidth={tab.primary ? 2.2 : 2}
                    />
                  </div>
                  <span className="sr-only">{tab.label}</span>
                  <span
                    className={cn(
                      'h-1 w-1 rounded-full',
                      isActive ? 'bg-text-primary' : 'bg-transparent',
                    )}
                    aria-hidden="true"
                  />
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
