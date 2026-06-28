type TFn = (key: string, vars?: Record<string, string | number>) => string

const ENUM_PREFIXES = [
  'SESSION_MODE_',
  'SESSION_STATUS_',
  'SECTION_STATUS_',
  'ATTEMPT_STATUS_',
  'TASK_TYPE_',
  'RECOMMENDATION_TYPE_',
  'PLAN_TYPE_',
  'RETRY_ITEM_STATUS_',
  'LEARNING_PLAN_ITEM_STATUS_',
  'LEARNING_PLAN_ITEM_TYPE_',
  'DAILY_BRIEF_ITEM_TYPE_',
] as const

/** Normalize backend enum / slug to a dictionary key (snake_case, lower). */
export function normalizeEnumToken(value: string): string {
  let token = value.trim()
  for (const prefix of ENUM_PREFIXES) {
    if (token.startsWith(prefix)) {
      token = token.slice(prefix.length)
      break
    }
  }
  token = token.toLowerCase()
  if (token === 'unspecified' || token === '') return 'unspecified'
  return token
}

function humanizeToken(token: string): string {
  return token
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function lookupEnum(t: TFn, category: string, raw: string | undefined | null): string {
  if (!raw) return ''
  const token = normalizeEnumToken(raw)
  const key = `enums.${category}.${token}`
  const label = t(key)
  if (label !== key) return label
  return humanizeToken(token)
}

export function skillKeyLabel(t: TFn, skillKey: string): string {
  const normalized = skillKey.trim().toLowerCase()
  if (!normalized) return ''

  const flatKey = `enums.skillKeys.${normalized.replace(/\./g, '_')}`
  const flat = t(flatKey)
  if (flat !== flatKey) return flat

  const parts = normalized.split('.').filter(Boolean)
  if (parts.length >= 2) {
    const domain = lookupEnum(t, 'skillDomain', parts[0])
    const criterionParts = parts.slice(1).join('_')
    const criterion = lookupEnum(t, 'skillCriterion', criterionParts)
    return `${domain} — ${criterion}`
  }

  const legacy = t(`skills.${normalized}`)
  if (legacy !== `skills.${normalized}`) return legacy

  return lookupEnum(t, 'skillDomain', normalized)
}

export function sessionModeLabel(t: TFn, mode?: string | null): string {
  if (!mode) return t('interview.defaultSession')
  return lookupEnum(t, 'sessionMode', mode)
}

export type { TFn }
