import type { SessionMode } from '@/lib/types'

export type PracticeSoloSection = 'algo' | 'coding' | 'sysdesign' | 'behavioral'

export interface ArticlePracticeSuggestion {
  soloSection: PracticeSoloSection
  mode: SessionMode
  mockPath: string
  labelKey: 'algo' | 'coding' | 'sysdesign' | 'behavioral' | 'generic'
}

const SOLO_BY_PREFIX: Array<{ prefix: string; soloSection: PracticeSoloSection; mode: SessionMode }> = [
  { prefix: 'algorithm.', soloSection: 'algo', mode: 'SESSION_MODE_ALGORITHMS_TRAINING' },
  { prefix: 'behavioral.', soloSection: 'behavioral', mode: 'SESSION_MODE_BEHAVIORAL_TRAINING' },
  { prefix: 'system', soloSection: 'sysdesign', mode: 'SESSION_MODE_SYSTEM_DESIGN_TRAINING' },
  { prefix: 'sysdesign', soloSection: 'sysdesign', mode: 'SESSION_MODE_SYSTEM_DESIGN_TRAINING' },
  { prefix: 'coding.', soloSection: 'coding', mode: 'SESSION_MODE_LIVE_CODING_TRAINING' },
  { prefix: 'live_coding', soloSection: 'coding', mode: 'SESSION_MODE_LIVE_CODING_TRAINING' },
]

/** Maps article skill keys to a solo training suggestion. */
export function resolveArticlePractice(skillKeys?: string[]): ArticlePracticeSuggestion | null {
  if (!skillKeys?.length) return null
  for (const key of skillKeys) {
    const normalized = key.trim().toLowerCase()
    for (const rule of SOLO_BY_PREFIX) {
      if (normalized.startsWith(rule.prefix)) {
        return {
          soloSection: rule.soloSection,
          mode: rule.mode,
          mockPath: `/mock?solo=${rule.soloSection}`,
          labelKey: rule.soloSection,
        }
      }
    }
  }
  return {
    soloSection: 'algo',
    mode: 'SESSION_MODE_ALGORITHMS_TRAINING',
    mockPath: '/mock',
    labelKey: 'generic',
  }
}

/** Skill domain chip for catalog filtering (first segment of skill_key). */
export function skillDomain(skillKey: string): string {
  const parts = skillKey.split('.')
  return parts[0] || skillKey
}

export function humanizeSkillDomain(domain: string): string {
  switch (domain) {
    case 'algorithm':
      return 'Algorithms'
    case 'behavioral':
      return 'Behavioral'
    case 'system':
    case 'sysdesign':
      return 'System design'
    case 'coding':
    case 'live_coding':
      return 'Live coding'
    default:
      return domain.replace(/_/g, ' ')
  }
}
