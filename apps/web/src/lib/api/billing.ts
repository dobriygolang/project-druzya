import { api } from '@/lib/apiClient'
import { asArray } from '@/lib/api/normalize'
import { normalizeBillingMe } from '@/lib/api/normalize'
import type { BillingMe, PlanCatalogEntry } from '@/lib/types'

export function getBillingMe() {
  return api<BillingMe>('/billing/me').then(normalizeBillingMe)
}

export function getBillingPlans() {
  return api<{ plans: PlanCatalogEntry[] }>('/billing/plans').then((res) => ({
    plans: asArray(res.plans).map(normalizePlanCatalog),
  }))
}

function normalizePlanCatalog(raw: PlanCatalogEntry): PlanCatalogEntry {
  const record = raw as PlanCatalogEntry & { checkoutUrl?: string; telegramCheckoutUrl?: string }
  const checkoutUrl = record.checkout_url ?? record.checkoutUrl
  const telegramCheckoutUrl = record.telegram_checkout_url ?? record.telegramCheckoutUrl
  return {
    slug: raw.slug,
    name: raw.name,
    tagline: raw.tagline ?? '',
    highlight: raw.highlight ?? false,
    highlights: asArray(raw.highlights),
    features: raw.features ?? {},
    limits: raw.limits ?? {},
    checkout_url: checkoutUrl,
    telegram_checkout_url: telegramCheckoutUrl,
  }
}
