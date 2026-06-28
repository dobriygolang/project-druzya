import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { useI18n } from '@/lib/i18n'
import type { ArticleSummary } from '@/lib/types'

export function ArticleRelatedArticles({ articles }: { articles: ArticleSummary[] }) {
  const { t } = useI18n()
  if (!articles.length) return null

  return (
    <div className="mt-8 border-t border-border pt-6">
      <Eyebrow>{t('learn.relatedTitle')}</Eyebrow>
      <ul className="mt-3 space-y-2">
        {articles.map((item) => (
          <li key={item.id}>
            <Link
              to={`/learn/${item.slug}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[13px] no-underline transition-colors hover:border-border-strong"
            >
              <div className="min-w-0">
                <div className="font-medium text-text-primary">{item.title}</div>
                <div className="truncate text-text-muted">{item.summary}</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
