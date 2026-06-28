import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { readAccessToken } from '@/lib/apiClient'

export function RequireAuth() {
  const location = useLocation()
  if (!readAccessToken()) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}
