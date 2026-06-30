import { API_BASE, ApiError, parseResponse } from '@/lib/apiClient'

export interface PublishedNote {
  title: string
  bodyMd: string
  publishedAt: string | null
}

function pickStr(j: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = j[k]
    if (typeof v === 'string') return v
  }
  return ''
}

function mapPublishedNote(j: Record<string, unknown>): PublishedNote {
  const publishedAt = pickStr(j, 'publishedAt', 'published_at')
  return {
    title: pickStr(j, 'title'),
    bodyMd: pickStr(j, 'bodyMd', 'body_md'),
    publishedAt: publishedAt || null,
  }
}

export async function fetchPublishedNote(slug: string): Promise<PublishedNote> {
  const path = `/notes/public/${encodeURIComponent(slug)}`
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
  })
  const body = await parseResponse<Record<string, unknown>>(path, res)
  return mapPublishedNote(body)
}

export function publishedNoteDisplayTitle(title: string): string {
  const t = title.trim()
  return t || 'Untitled note'
}

export { ApiError }
