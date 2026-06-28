import { Eyebrow } from '@/components/brand/Eyebrow'
import type { Article, ArticleVideo } from '@/lib/types'
import { ArticleMarkdown } from '@/lib/learn/markdown'
import { formatVideoDuration, vimeoEmbedUrl, youtubeEmbedUrl } from '@/lib/learn/video'
import { useI18n } from '@/lib/i18n'

function ArticleVideoEmbed({ video }: { video: ArticleVideo }) {
  const embed =
    video.provider === 'ARTICLE_VIDEO_PROVIDER_YOUTUBE'
      ? youtubeEmbedUrl(video.url)
      : video.provider === 'ARTICLE_VIDEO_PROVIDER_VIMEO'
        ? vimeoEmbedUrl(video.url)
        : null
  const duration = formatVideoDuration(video.duration_seconds)

  if (!embed) {
    return (
      <a
        href={video.url}
        target="_blank"
        rel="noreferrer"
        className="block rounded-xl border border-border bg-surface-2 px-4 py-3 text-[14px] text-accent hover:underline"
      >
        {video.title}
      </a>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <div className="aspect-video w-full">
        <iframe
          title={video.title}
          src={embed}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <div className="border-t border-border bg-surface-1 px-4 py-2 text-[13px]">
        <span className="font-medium">{video.title}</span>
        {duration ? <span className="ml-2 text-text-muted">{duration}</span> : null}
      </div>
    </div>
  )
}

export function ArticleContent({
  article,
  showDraftBanner = false,
}: {
  article: Article
  showDraftBanner?: boolean
}) {
  const { t } = useI18n()
  const videos = [...(article.videos ?? [])].sort((a, b) => a.position - b.position)

  return (
    <>
      {showDraftBanner ? (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-200">
          {t('learn.previewDraft')}
        </div>
      ) : null}
      {article.reading_minutes ? (
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
          {t('learn.readingMinutes', { count: article.reading_minutes })}
        </p>
      ) : null}
      <div>
        <ArticleMarkdown body={article.body} />
      </div>
      {videos.length > 0 ? (
        <div className="mt-8 border-t border-border pt-6">
          <Eyebrow>{t('learn.videos')}</Eyebrow>
          <div className="mt-4 space-y-4">
            {videos.map((video, index) => (
              <ArticleVideoEmbed key={`${video.url}-${index}`} video={video} />
            ))}
          </div>
        </div>
      ) : null}
      {article.skill_keys && article.skill_keys.length > 0 ? (
        <div className="mt-6 border-t border-border pt-4">
          <Eyebrow>{t('learn.skills')}</Eyebrow>
          <ul className="mt-2 flex flex-wrap gap-2">
            {article.skill_keys.map((key) => (
              <li
                key={key}
                className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[11px] text-text-secondary"
              >
                {key}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  )
}
