import { api } from '@/lib/apiClient'
import { normalizeBillingMe } from '@/lib/api/normalize'
import type { BillingMe } from '@/lib/types'

export function getBillingMe() {
  return api<BillingMe>('/billing/me').then(normalizeBillingMe)
}
