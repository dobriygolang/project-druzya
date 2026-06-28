import type { PlanCatalogEntry } from '@/lib/types'

export type { PlanCatalogEntry }

export function findPlanCatalog(
  plans: PlanCatalogEntry[],
  slug: string,
): PlanCatalogEntry | undefined {
  return plans.find((p) => p.slug === slug)
}
