import type { ArticleVideoProvider } from '@/lib/types'

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
  /youtube\.com\/shorts\/([\w-]{11})/,
]

const VIMEO_PATTERN = /vimeo\.com\/(?:video\/)?(\d+)/

export function detectVideoProvider(url: string): ArticleVideoProvider {
  if (YOUTUBE_PATTERNS.some((p) => p.test(url))) {
    return 'ARTICLE_VIDEO_PROVIDER_YOUTUBE'
  }
  if (VIMEO_PATTERN.test(url)) {
    return 'ARTICLE_VIDEO_PROVIDER_VIMEO'
  }
  return 'ARTICLE_VIDEO_PROVIDER_OTHER'
}

export function youtubeEmbedUrl(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return `https://www.youtube-nocookie.com/embed/${match[1]}`
    }
  }
  return null
}

export function vimeoEmbedUrl(url: string): string | null {
  const match = url.match(VIMEO_PATTERN)
  if (match?.[1]) {
    return `https://player.vimeo.com/video/${match[1]}`
  }
  return null
}

export function formatVideoDuration(seconds?: number): string | null {
  if (seconds == null || seconds <= 0) return null
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins >= 60) {
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    return `${hours}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}
