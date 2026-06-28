import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getAdminSession } from '@/lib/api/admin'
import { PageContent } from '@/components/PageContent'

export function RequireAdmin() {
  const location = useLocation()
  const sessionQ = useQuery({
    queryKey: ['admin-session'],
    queryFn: getAdminSession,
    retry: false,
  })

  if (sessionQ.isLoading) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Checking admin access…</p>
      </PageContent>
    )
  }

  if (sessionQ.isError) {
    return (
      <PageContent>
        <h1 className="font-display text-2xl font-bold">Admin access denied</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Your account is not in the operator allowlist, or the admin API is unavailable.
        </p>
      </PageContent>
    )
  }

  if (!sessionQ.data?.user_id) {
    return <Navigate to="/today" state={{ from: location }} replace />
  }

  return <Outlet context={{ userId: sessionQ.data.user_id }} />
}
