import type { ReactNode } from 'react'
import { FeatureUnavailable } from '@/components/FeatureUnavailable'
import type { FeatureEntry, FeatureStatus } from '@/lib/migration/types'

type RequireFeatureProps = {
  feature: FeatureEntry
  children: ReactNode
}

const LIVE_STATUSES: FeatureStatus[] = ['ready', 'partial', 'in_progress']

export function RequireFeature({ feature, children }: RequireFeatureProps) {
  if (LIVE_STATUSES.includes(feature.status)) {
    return <>{children}</>
  }

  const reason =
    feature.status === 'stub'
      ? 'Функция ещё не подключена к новому backend. Данные не подменяются моками.'
      : feature.status === 'deprecated'
        ? 'Маршрут снят с поддержки.'
        : 'Страница не перенесена из legacy frontend.'

  return (
    <FeatureUnavailable
      title={feature.label}
      reason={reason}
      backend={feature.backend}
      legacySource={feature.legacySource}
      trackingNote={feature.note}
    />
  )
}

/** Shorthand when you only have path lookup */
export function requireFeatureStatus(
  feature: FeatureEntry | undefined,
  children: ReactNode,
  fallbackTitle = 'Страница недоступна',
): ReactNode {
  if (!feature) {
    return (
      <FeatureUnavailable
        title={fallbackTitle}
        reason="Маршрут не зарегистрирован в migration registry."
      />
    )
  }
  return <RequireFeature feature={feature}>{children}</RequireFeature>
}
