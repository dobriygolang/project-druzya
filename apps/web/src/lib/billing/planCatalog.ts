/**
 * Plan catalog mirrored from billing migration `00002_entitlements.sql`.
 * There is no public ListPlans RPC — this is static product metadata, not user data.
 * Update when plan_entitlements seeds change.
 */
export type PlanCatalogEntry = {
  slug: string
  name: string
  tagline: string
  /** Counter + bool entitlements for marketing display */
  highlights: string[]
  highlight?: boolean
}

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    slug: 'free',
    name: 'Free',
    tagline: 'Попробовать без оплаты',
    highlights: [
      '5 AI-оценок в день',
      '2 mock-интервью в месяц',
      '30 запусков кода в день',
      'Рекомендации и учебный план',
    ],
  },
  {
    slug: 'pro_monthly',
    name: 'Pro',
    tagline: 'Для плотной подготовки',
    highlight: true,
    highlights: [
      '100 AI-оценок в день',
      '30 mock-интервью в месяц',
      '500 запусков кода в день',
      'Шаблоны компаний и скрытые тесты',
      'Расширенный AI-фидбек',
    ],
  },
]

export function findPlanCatalog(slug: string): PlanCatalogEntry | undefined {
  return PLAN_CATALOG.find((p) => p.slug === slug)
}
