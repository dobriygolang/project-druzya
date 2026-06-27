import { Link, NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { logout } from '@/lib/api/auth'

const nav = [
  { to: '/dashboard', label: 'Главная' },
  { to: '/interview', label: 'Интервью' },
  { to: '/profile', label: 'Профиль' },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="hair-b bg-surface-1">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="font-semibold tracking-tight text-text-primary">
            druzya
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'rounded-full px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-surface-2 font-medium text-text-primary'
                      : 'text-text-muted hover:text-text-primary',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => void onLogout()}
              className="ml-2 rounded-full px-3 py-1.5 text-sm text-text-muted hover:text-text-primary"
            >
              Выйти
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
