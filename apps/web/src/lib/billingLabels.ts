export type UsageLimit = {
  used: number
  limit?: number
  remaining?: number
  unlimited?: boolean
}

type CounterMeta = {
  label: string
  period: 'day' | 'month'
}

/** Known billing counter keys → display copy (matches plan_entitlements in billing service). */
const COUNTER_META: Record<string, CounterMeta> = {
  mock_interviews_per_month: { label: 'Mock-интервью', period: 'month' },
  ai_evaluations_per_day: { label: 'AI-оценки ответов', period: 'day' },
  code_runs_per_day: { label: 'Запуски кода', period: 'day' },
  live_rooms_per_month: { label: 'Live-комнаты', period: 'month' },
  live_rooms_concurrent: { label: 'Одновременные live-комнаты', period: 'month' },
}

const PERIOD_LABEL: Record<CounterMeta['period'], string> = {
  day: 'сегодня',
  month: 'в месяц',
}

/** Preferred display order on profile. Unknown keys sort after these. */
export const COUNTER_DISPLAY_ORDER = [
  'mock_interviews_per_month',
  'ai_evaluations_per_day',
  'code_runs_per_day',
  'live_rooms_per_month',
  'live_rooms_concurrent',
] as const

export function entitlementLabel(key: string): string {
  return COUNTER_META[key]?.label ?? humanizeEntitlementKey(key)
}

export function formatLimitUsage(key: string, lim: UsageLimit): string {
  if (lim.unlimited) return 'без лимита'
  const meta = COUNTER_META[key]
  const period = meta ? ` ${PERIOD_LABEL[meta.period]}` : ''
  if (lim.limit == null) return `${lim.used}${period}`.trim()
  return `${lim.used} из ${lim.limit}${period}`
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

/** User-facing plan title; hides internal slugs like pro_monthly. */
export function formatPlanName(planName: string, planSlug: string): string {
  if (planName && planName !== planSlug) return planName
  if (planSlug === 'free') return 'Free'
  if (planSlug === 'pro_monthly') return 'Pro'
  return planName || planSlug
}
