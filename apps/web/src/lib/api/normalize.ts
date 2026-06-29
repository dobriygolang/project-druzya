import type { BillingMe, CodeRun, User } from '@/lib/types'

export function asArray<T>(value: T[] | undefined | null): T[] {
  return value ?? []
}

export function asRecord<T extends Record<string, unknown>>(value: T | undefined | null): T {
  return value ?? ({} as T)
}

export function normalizeCodeRun(raw: CodeRun): CodeRun {
  return {
    ...raw,
    tests_total: raw.tests_total ?? 0,
    tests_passed: raw.tests_passed ?? 0,
    test_results: asArray(raw.test_results),
  }
}

export function normalizeBillingMe(raw: BillingMe): BillingMe {
  const record = raw as BillingMe & {
    isTrialing?: boolean
    trialEnd?: string
    trialAvailable?: boolean
    trialDays?: number
  }
  return {
    ...raw,
    user_id: raw.user_id ?? '',
    plan_slug: raw.plan_slug ?? 'free',
    plan_name: raw.plan_name ?? 'Free',
    features: asRecord(raw.features),
    limits: asRecord(raw.limits),
    is_trialing: record.is_trialing ?? record.isTrialing ?? false,
    trial_end: record.trial_end ?? record.trialEnd,
    trial_available: record.trial_available ?? record.trialAvailable ?? false,
    trial_days: record.trial_days ?? record.trialDays,
  }
}

export function normalizeUser(raw?: User | null): User {
  if (!raw) throw new Error('missing user in response')
  const record = raw as User & { avatarUrl?: string; createdAt?: string; telegramId?: string }
  return {
    id: record.id,
    username: record.username,
    avatar_url: record.avatar_url || record.avatarUrl || undefined,
    created_at: record.created_at || record.createdAt,
    telegram_id:
      record.telegram_id != null
        ? String(record.telegram_id)
        : record.telegramId != null
          ? String(record.telegramId)
          : undefined,
    timezone: record.timezone || undefined,
  }
}
