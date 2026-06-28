const SOLO_ID_BY_MODE: Record<string, string> = {
  algorithms_training: 'algo',
  live_coding_training: 'coding',
  system_design_training: 'sysdesign',
  behavioral_training: 'behavioral',
  sql_training: 'coding',
}

export function soloSectionIdFromSessionMode(mode: string): string | null {
  const normalized = mode
    .replace(/^SESSION_MODE_/i, '')
    .replace(/_TRAINING$/i, '_training')
    .toLowerCase()
  if (normalized.endsWith('_training')) {
    const key = normalized
    return SOLO_ID_BY_MODE[key] ?? null
  }
  return SOLO_ID_BY_MODE[normalized] ?? SOLO_ID_BY_MODE[`${normalized}_training`] ?? null
}

export function sessionModeLabelKey(mode: string): string {
  const upper = mode.toUpperCase().startsWith('SESSION_MODE_')
    ? mode.toUpperCase()
    : `SESSION_MODE_${mode.toUpperCase()}`
  return upper.endsWith('_TRAINING') ? upper : `${upper}_TRAINING`
}
