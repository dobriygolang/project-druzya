import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'

export type UsageLimit = {
  used: number
  limit?: number
  remaining?: number
  unlimited?: boolean
}

/** Preferred display order on profile. Unknown keys sort after these. */
export const COUNTER_DISPLAY_ORDER = [
  'cloud_notes_count',
  'code_runs_per_day',
  'live_rooms_per_month',
  'live_rooms_concurrent',
  'focus_stats_history_days',
] as const

type TFn = (key: string, vars?: Record<string, string | number>) => string

function counterPeriodKey(key: string): 'periodDay' | 'periodMonth' | null {
  if (key.endsWith('_per_day')) return 'periodDay'
  if (key.endsWith('_per_month') || key.endsWith('_concurrent')) return 'periodMonth'
  return null
}

export function entitlementLabelWith(t: TFn, key: string): string {
  const label = t(`billing.counters.${key}`)
  if (label !== `billing.counters.${key}`) return label
  return humanizeEntitlementKey(key)
}

export function formatLimitUsageWith(t: TFn, key: string, lim: UsageLimit): string {
  if (lim.unlimited) return t('common.unlimited')
  const periodKey = counterPeriodKey(key)
  const periodRaw = periodKey ? t(`billing.${periodKey}`) : ''
  const period = periodRaw ? (periodRaw.startsWith(' ') ? periodRaw : ` ${periodRaw}`) : ''
  if (lim.limit == null) return t('billing.usedOnly', { used: lim.used, period })
  return t('billing.usedOf', { used: lim.used, limit: lim.limit, period })
}

export function limitProgressPct(lim: UsageLimit): number | null {
  if (lim.unlimited || lim.limit == null || lim.limit <= 0) return null
  return Math.min(100, Math.round((lim.used / lim.limit) * 100))
}

export function sortLimitEntries(entries: [string, UsageLimit][]): [string, UsageLimit][] {
  const order = new Map(COUNTER_DISPLAY_ORDER.map((k, i) => [k, i]))
  return [...entries].sort(([a], [b]) => {
    const ia = order.get(a as (typeof COUNTER_DISPLAY_ORDER)[number]) ?? 999
    const ib = order.get(b as (typeof COUNTER_DISPLAY_ORDER)[number]) ?? 999
    if (ia !== ib) return ia - ib
    return a.localeCompare(b)
  })
}

/** User-facing plan title; hides internal slugs like pro_monthly. */
export function formatPlanName(planName: string, planSlug: string): string {
  if (planName && planName !== planSlug) return planName
  if (planSlug === 'free') return 'Free'
  if (planSlug === 'pro_monthly') return 'Pro'
  return planName || planSlug
}

export function useBillingLabels() {
  const { t } = useI18n()
  return useMemo(
    () => ({
      entitlementLabel: (key: string) => entitlementLabelWith(t, key),
      formatLimitUsage: (key: string, lim: UsageLimit) => formatLimitUsageWith(t, key, lim),
    }),
    [t],
  )
}

function humanizeEntitlementKey(key: string): string {
  return key
    .replace(/_per_day$/, '')
    .replace(/_per_month$/, '')
    .replace(/_enabled$/, '')
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** @deprecated use useBillingLabels */
export function entitlementLabel(key: string): string {
  return humanizeEntitlementKey(key)
}

/** @deprecated use useBillingLabels */
export function formatLimitUsage(key: string, lim: UsageLimit): string {
  if (lim.unlimited) return 'без лимита'
  const period = key.endsWith('_per_day') ? ' сегодня' : key.endsWith('_per_month') ? ' в месяц' : ''
  if (lim.limit == null) return `${lim.used}${period}`.trim()
  return `${lim.used} из ${lim.limit}${period}`
}
