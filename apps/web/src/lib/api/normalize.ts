import type {
  BillingMe,
  CodeRun,
  DailyBrief,
  DailyBriefItem,
  Dashboard,
  EvaluationResult,
  Progress,
  Session,
  SessionSection,
  SessionTask,
  User,
} from '@/lib/types'

export function asArray<T>(value: T[] | undefined | null): T[] {
  return value ?? []
}

export function asRecord<T extends Record<string, unknown>>(value: T | undefined | null): T {
  return value ?? ({} as T)
}

export function normalizeProgress(raw?: Partial<Progress>): Progress {
  return {
    total_tasks: raw?.total_tasks ?? 0,
    evaluated_tasks: raw?.evaluated_tasks ?? 0,
    skipped_tasks: raw?.skipped_tasks ?? 0,
    total_sections: raw?.total_sections ?? 0,
    done_sections: raw?.done_sections ?? 0,
  }
}

export function normalizeDashboard(raw: Dashboard & { dailyBrief?: DailyBrief }): Dashboard {
  const briefRaw = raw.daily_brief ?? raw.dailyBrief
  return {
    readiness_score: raw.readiness_score ?? 0,
    pending_retry_count: raw.pending_retry_count ?? 0,
    strengths: asArray(raw.strengths),
    weaknesses: asArray(raw.weaknesses),
    recommendations: asArray(raw.recommendations),
    daily_brief: briefRaw ? normalizeDailyBrief(briefRaw) : undefined,
    read_article_slugs: asArray(
      raw.read_article_slugs ??
        (raw as Dashboard & { readArticleSlugs?: string[] }).readArticleSlugs,
    ),
  }
}

function normalizeDailyBrief(raw: DailyBrief & { items?: DailyBriefItem[] }): DailyBrief {
  const items = asArray(raw.items).map((item) => ({
    type: item.type,
    title: item.title,
    description: item.description,
    action_label: item.action_label ?? (item as DailyBriefItem & { actionLabel?: string }).actionLabel,
    action_path: item.action_path ?? (item as DailyBriefItem & { actionPath?: string }).actionPath,
    retry_item_id:
      item.retry_item_id ?? (item as DailyBriefItem & { retryItemId?: string }).retryItemId,
    skill_key: item.skill_key ?? (item as DailyBriefItem & { skillKey?: string }).skillKey,
    secondary_action_label:
      item.secondary_action_label ??
      (item as DailyBriefItem & { secondaryActionLabel?: string }).secondaryActionLabel,
    secondary_action_path:
      item.secondary_action_path ??
      (item as DailyBriefItem & { secondaryActionPath?: string }).secondaryActionPath,
  }))
  return {
    readiness_score: raw.readiness_score ?? 0,
    items,
  }
}

export function normalizeSessionBundle<
  T extends {
    session: Session
    sections?: SessionSection[]
    tasks?: SessionTask[]
    progress?: Progress
  },
>(raw: T) {
  return {
    ...raw,
    sections: asArray(raw.sections),
    tasks: asArray(raw.tasks),
    progress: normalizeProgress(raw.progress),
  }
}

export function normalizeSessionResults(raw: {
  session: Session
  sections?: SessionSection[]
  tasks?: SessionTask[]
  evaluations?: EvaluationResult[]
  progress?: Progress
}) {
  return {
    ...raw,
    sections: asArray(raw.sections),
    tasks: asArray(raw.tasks),
    evaluations: asArray(raw.evaluations),
    progress: normalizeProgress(raw.progress),
  }
}

export function normalizeCurrentSessionState(raw: {
  session: Session
  sections?: SessionSection[]
  current_section?: SessionSection
  current_task?: SessionTask
  progress?: Progress
}) {
  return {
    ...raw,
    sections: asArray(raw.sections),
    progress: normalizeProgress(raw.progress),
  }
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
