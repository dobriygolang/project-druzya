import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import {
  lookupEnum,
  sessionModeLabel,
  skillKeyLabel,
} from '@/lib/labels/domainLabels'

export function useDomainLabels() {
  const { t } = useI18n()
  return useMemo(
    () => ({
      sessionMode: (mode?: string | null) => sessionModeLabel(t, mode),
      sessionStatus: (status: string) => lookupEnum(t, 'sessionStatus', status),
      sectionStatus: (status: string) => lookupEnum(t, 'sectionStatus', status),
      attemptStatus: (status: string) => lookupEnum(t, 'attemptStatus', status),
      taskType: (type: string) => lookupEnum(t, 'taskType', type),
      sectionType: (type: string) => lookupEnum(t, 'sectionType', type),
      skillKey: (key: string) => skillKeyLabel(t, key),
      skillDomain: (domain: string) => lookupEnum(t, 'skillDomain', domain),
      difficulty: (level: string) => lookupEnum(t, 'difficulty', level),
      enumLabel: (category: string, value: string) => lookupEnum(t, category, value),
    }),
    [t],
  )
}

export { lookupEnum, sessionModeLabel, skillKeyLabel, normalizeEnumToken } from '@/lib/labels/domainLabels'
