import { useLocation } from 'react-router-dom'
import { FeatureUnavailable } from '@/components/FeatureUnavailable'
import { RequireFeature } from '@/components/RequireFeature'
import { getFeatureByPath } from '@/lib/migration'

/** Renders FeatureUnavailable for routes registered as stub/absent in features.ts */
export default function FeatureStubPage() {
  const { pathname } = useLocation()
  const feature = getFeatureByPath(pathname)

  if (!feature) {
    return (
      <FeatureUnavailable
        title="Страница недоступна"
        reason="Маршрут не найден в migration registry. Добавь запись в src/lib/migration/features.ts."
      />
    )
  }

  return (
    <RequireFeature feature={feature}>
      {/* Live pages replace this stub when status → ready */}
      <span hidden>{feature.path}</span>
    </RequireFeature>
  )
}
