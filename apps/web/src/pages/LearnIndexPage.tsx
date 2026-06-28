import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, CheckCircle2 } from 'lucide-react'
import { PageHeader, SdvgCard } from '@/components/brand/SdvgCard'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { listArticles } from '@/lib/api/content'
import { getDashboard } from '@/lib/api/recommendation'
import { formatApiError } from '@/lib/apiClient'
import { skillDomain } from '@/lib/learn/practice'
import { useI18n } from '@/lib/i18n'
import { useDomainLabels } from '@/lib/labels'
import type { ArticleSummary } from '@/lib/types'
import { cn } from '@/lib/cn'

function collectDomains(articles: ArticleSummary[]): string[] {
  const set = new Set<string>()
  for (const article of articles) {
    for (const key of article.skill_keys ?? []) {
      set.add(skillDomain(key))
    }
  }
  return [...set].sort()
}

export default function LearnIndexPage() {
  const { t } = useI18n()
  const labels = useDomainLabels()
  const [domain, setDomain] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const articlesQ = useQuery({
    queryKey: ['articles', searchQuery],
    queryFn: () => listArticles({ limit: 100, query: searchQuery || undefined }),
  })

  const dashboardQ = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
  })

  const readSlugs = useMemo(
    () => new Set(dashboardQ.data?.read_article_slugs ?? []),
    [dashboardQ.data?.read_article_slugs],
  )

  const articles = useMemo(() => {
    const all = articlesQ.data?.articles ?? []
    if (!domain) return all
    return all.filter((article) =>
      (article.skill_keys ?? []).some((key) => skillDomain(key) === domain),
    )
  }, [articlesQ.data?.articles, domain])

  const domains = useMemo(
    () => collectDomains(articlesQ.data?.articles ?? []),
    [articlesQ.data?.articles],
  )

  return (
    <PageContent className="gap-8">
      <PageHeader
        eyebrow={t('learn.eyebrow')}
        title={t('learn.catalogTitle')}
        description={t('learn.catalogDescription')}
      />

      <label className="block max-w-md">
        <span className="sr-only">{t('learn.searchPlaceholder')}</span>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('learn.searchPlaceholder')}
          className="w-full rounded-xl border border-border bg-surface-1 px-4 py-2.5 text-sm outline-none focus:border-border-strong"
        />
      </label>

      {domains.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={domain == null} onClick={() => setDomain(null)}>
            {t('learn.filterAll')}
          </FilterChip>
          {domains.map((d) => (
            <FilterChip key={d} active={domain === d} onClick={() => setDomain(d)}>
              {labels.skillDomain(d)}
            </FilterChip>
          ))}
        </div>
      ) : null}

      {articlesQ.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface-2" aria-hidden />
          ))}
        </div>
      ) : null}

      {articlesQ.isError ? (
        <ErrorMessage message={formatApiError(articlesQ.error)} onRetry={() => void articlesQ.refetch()} />
      ) : null}

      {articlesQ.isSuccess && articles.length === 0 ? (
        <p className="text-[14px] text-text-muted">
          {searchQuery ? t('learn.searchEmpty') : t('learn.catalogEmpty')}
        </p>
      ) : null}

      {articlesQ.isSuccess && articles.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {articles.map((article) => {
            const read = readSlugs.has(article.slug)
            return (
            <li key={article.id}>
              <Link to={`/learn/${article.slug}`} className="block h-full no-underline">
                <SdvgCard
                  className="h-full transition-colors hover:border-border-strong"
                  eyebrow={
                    article.reading_minutes
                      ? t('learn.readingMinutes', { count: article.reading_minutes })
                      : t('learn.eyebrow')
                  }
                  title={article.title}
                  description={article.summary}
                >
                  {read ? (
                    <div className="mb-2 inline-flex items-center gap-1 text-[11px] text-text-muted">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" aria-hidden />
                      {t('learn.readBadge')}
                    </div>
                  ) : null}
                  {article.skill_keys?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {article.skill_keys.map((key) => (
                        <span
                          key={key}
                          className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[10px] text-text-secondary"
                        >
                          {labels.skillKey(key)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-text-primary">
                    <BookOpen className="h-3.5 w-3.5" aria-hidden />
                    {t('learn.openArticle')}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </SdvgCard>
              </Link>
            </li>
            )
          })}
        </ul>
      ) : null}
    </PageContent>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-[13px] transition-colors',
        active
          ? 'border-border-strong bg-surface-2 font-medium text-text-primary'
          : 'border-border bg-surface-1 text-text-secondary hover:border-border-strong hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}
