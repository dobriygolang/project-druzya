import { API_BASE, ApiError, parseResponse } from '@/lib/apiClient'

export interface PublishedBoard {
  title: string
  sceneJson: string
  publishedAt: string | null
}

function pickStr(j: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = j[k]
    if (typeof v === 'string') return v
  }
  return ''
}

function mapPublishedBoard(j: Record<string, unknown>): PublishedBoard {
  const publishedAt = pickStr(j, 'publishedAt', 'published_at')
  return {
    title: pickStr(j, 'title'),
    sceneJson: pickStr(j, 'sceneJson', 'scene_json'),
    publishedAt: publishedAt || null,
  }
}

export async function fetchPublishedBoard(slug: string): Promise<PublishedBoard> {
  const path = `/rooms/boards/public/${encodeURIComponent(slug)}`
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
  })
  const body = await parseResponse<Record<string, unknown>>(path, res)
  return mapPublishedBoard(body)
}

export function publishedBoardDisplayTitle(title: string): string {
  const t = title.trim()
  return t || 'Untitled board'
}

export { ApiError }
