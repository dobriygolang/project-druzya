import { useQuery } from '@tanstack/react-query'
import { getAdminSession } from '@/lib/api/admin'

/** Cached with RequireAdmin via shared query key. */
export function useIsAdmin() {
  const q = useQuery({
    queryKey: ['admin-session'],
    queryFn: getAdminSession,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  return {
    isAdmin: !!q.data?.user_id,
    isLoading: q.isLoading,
  }
}
