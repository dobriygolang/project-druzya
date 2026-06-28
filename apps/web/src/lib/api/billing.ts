import { api } from '@/lib/apiClient'
import { asArray } from '@/lib/api/normalize'
import { normalizeBillingMe } from '@/lib/api/normalize'
import type { BillingMe, PlanCatalogEntry } from '@/lib/types'

export function getBillingMe() {
  return api<BillingMe>('/billing/me').then(normalizeBillingMe)
}

export function startProTrial() {
  return api<{ plan_slug: string; trial_end?: string; trial_days?: number }>('/billing/trial/start', {
    method: 'POST',
  })
}

export function getBillingPlans() {
  return api<{ plans: PlanCatalogEntry[] }>('/billing/plans').then((res) => ({
    plans: asArray(res.plans).map(normalizePlanCatalog),
  }))
}

function normalizePlanCatalog(raw: PlanCatalogEntry): PlanCatalogEntry {
  const record = raw as PlanCatalogEntry & { checkoutUrl?: string; telegramCheckoutUrl?: string; trialDays?: number }
  const checkoutUrl = record.checkout_url ?? record.checkoutUrl
  const telegramCheckoutUrl = record.telegram_checkout_url ?? record.telegramCheckoutUrl
  const trialDays = record.trial_days ?? record.trialDays
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
    trial_days: trialDays,
  }
}
