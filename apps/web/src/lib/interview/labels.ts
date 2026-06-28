import { lookupEnum, type TFn } from '@/lib/labels/domainLabels'

/** @deprecated use useDomainLabels().sessionMode */
export function formatSessionMode(t: TFn, mode: string): string {
  return lookupEnum(t, 'sessionMode', mode)
}

/** @deprecated use useDomainLabels().sessionStatus */
export function formatSessionStatus(t: TFn, status: string): string {
  return lookupEnum(t, 'sessionStatus', status)
}

/** @deprecated use useDomainLabels().sectionStatus */
export function formatSectionStatus(t: TFn, status: string): string {
  return lookupEnum(t, 'sectionStatus', status)
}

export type { TFn }
