import { api } from '@/lib/apiClient'
import type { BillingMe } from '@/lib/types'

export function getBillingMe() {
  return api<BillingMe>('/billing/me')
}
