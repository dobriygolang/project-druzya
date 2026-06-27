import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { readAccessToken } from '@/lib/apiClient'

export function RequireAuth() {
  const location = useLocation()
  if (!readAccessToken()) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return <Outlet />
}
