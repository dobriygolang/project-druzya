import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { ArticleContent } from '@/components/learn/ArticleContent'
import { ArticleLinkedTasks } from '@/components/learn/ArticleLinkedTasks'
import { ArticlePracticeCard } from '@/components/learn/ArticlePracticeCard'
import { ArticleRelatedArticles } from '@/components/learn/ArticleRelatedArticles'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { getAdminArticle } from '@/lib/api/admin'
import { getArticle } from '@/lib/api/content'
import { getDashboard } from '@/lib/api/recommendation'
import { formatApiError } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { useArticleReadTracker } from '@/lib/learn/useArticleReadTracker'
import type { ArticleSummary } from '@/lib/types'

export default function LearnArticlePage() {
  const { slug = '' } = useParams()
  const [searchParams] = useSearchParams()
  const preview = searchParams.get('preview') === '1'
  const { t } = useI18n()

  const articleQ = useQuery({
    queryKey: ['article', slug, preview ? 'preview' : 'public'],
    queryFn: () => (preview ? getAdminArticle(slug) : getArticle(slug)),
    enabled: slug.length > 0,
  })

  const dashboardQ = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    enabled: !preview,
  })

  const alreadyRead = (dashboardQ.data?.read_article_slugs ?? []).includes(slug)
  useArticleReadTracker(slug, !preview && !alreadyRead)

  if (articleQ.isLoading) {
    return (
      <PageContent>
        <div className="h-48 animate-pulse rounded-2xl bg-surface-2" aria-hidden />
      </PageContent>
    )
  }

  if (articleQ.isError) {
    return (
      <PageContent>
        <ErrorMessage message={formatApiError(articleQ.error)} onRetry={() => void articleQ.refetch()} />
      </PageContent>
    )
  }

  const article = articleQ.data?.article
  if (!article) return null
  const related: ArticleSummary[] = preview
    ? []
    : ((articleQ.data as { related_articles?: ArticleSummary[] } | undefined)?.related_articles ?? [])

  const isDraft =
    preview &&
    article.status !== 'ARTICLE_STATUS_PUBLISHED' &&
    article.status !== 'ARTICLE_STATUS_UNSPECIFIED'

  return (
    <PageContent className="gap-6">
      <Link to={preview ? '/admin/articles' : '/learn'} className="inline-flex no-underline">
        <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />}>
          {preview ? 'Back to admin' : t('learn.backCatalog')}
        </Button>
      </Link>

      <SdvgCard eyebrow={t('learn.eyebrow')} title={article.title} description={article.summary}>
        {!preview && alreadyRead ? (
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-text-secondary">
            <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" aria-hidden />
            {t('learn.alreadyRead')}
          </div>
        ) : null}
        <ArticleContent article={article} showDraftBanner={isDraft} />
        {!preview ? <ArticleLinkedTasks article={article} /> : null}
        {!preview ? <ArticlePracticeCard article={article} /> : null}
        {!preview ? <ArticleRelatedArticles articles={related} /> : null}
      </SdvgCard>
    </PageContent>
  )
}
