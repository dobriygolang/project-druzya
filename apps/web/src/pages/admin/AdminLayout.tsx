import { NavLink, Outlet } from 'react-router-dom'
import { PageContent } from '@/components/PageContent'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm ${isActive ? 'bg-surface-2 text-text-primary' : 'text-text-muted hover:text-text-primary'}`

export default function AdminLayout() {
  return (
    <PageContent className="gap-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">Operator</p>
        <h1 className="font-display text-3xl font-bold">Admin</h1>
      </header>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        <NavLink to="/admin" end className={linkClass}>
          Overview
        </NavLink>
        <NavLink to="/admin/companies" className={linkClass}>
          Companies
        </NavLink>
        <NavLink to="/admin/tasks" className={linkClass}>
          Tasks
        </NavLink>
        <NavLink to="/admin/articles" className={linkClass}>
          Articles
        </NavLink>
        <NavLink to="/admin/templates" className={linkClass}>
          Templates
        </NavLink>
        <NavLink to="/admin/billing" className={linkClass}>
          Billing
        </NavLink>
        <NavLink to="/admin/ai" className={linkClass}>
          AI
        </NavLink>
      </nav>

      <Outlet />
    </PageContent>
  )
}
