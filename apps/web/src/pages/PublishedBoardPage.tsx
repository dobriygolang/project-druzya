import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

import {
  ApiError,
  fetchPublishedBoard,
  publishedBoardDisplayTitle,
  type PublishedBoard,
} from '@/lib/api/publicBoards'
import {
  EXCALIDRAW_MOUNT_CLASS,
  EXCALIDRAW_THEME,
  EXCALIDRAW_UI_OPTIONS,
  excalidrawSiteAppState,
} from '@/lib/collab/excalidrawTheme'
import { applyDocumentMeta } from '@/lib/site/documentMeta'
import { useI18n } from '@/lib/i18n'

function parseScene(raw: string): { elements: unknown[]; files: Record<string, unknown> } {
  if (!raw.trim()) return { elements: [], files: {} }
  try {
    const j = JSON.parse(raw) as { elements?: unknown[]; files?: Record<string, unknown> }
    return {
      elements: Array.isArray(j.elements) ? j.elements : [],
      files: j.files && typeof j.files === 'object' ? j.files : {},
    }
  } catch {
    return { elements: [], files: {} }
  }
}

export default function PublishedBoardPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { t } = useI18n()
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'ok'; board: PublishedBoard } | { kind: 'error'; status: number }
  >({ kind: 'loading' })

  useEffect(() => {
    if (!slug) {
      setState({ kind: 'error', status: 404 })
      return
    }
    let live = true
    setState({ kind: 'loading' })
    void fetchPublishedBoard(slug)
      .then((board) => {
        if (live) setState({ kind: 'ok', board })
      })
      .catch((err: unknown) => {
        if (!live) return
        const status = err instanceof ApiError ? err.status : 500
        setState({ kind: 'error', status })
      })
    return () => {
      live = false
    }
  }, [slug])

  const title =
    state.kind === 'ok' ? publishedBoardDisplayTitle(state.board.title) : 'Board not found'

  useEffect(() => {
    document.documentElement.classList.add('dark')
    applyDocumentMeta({
      title:
        state.kind === 'ok'
          ? t('seo.pages.publishedBoard.title', { title })
          : 'Board not found',
      description: t('seo.pages.publishedBoard.description'),
      keywords: t('seo.keywords'),
      path: slug ? `/board/${slug}` : '/board',
    })
    return () => {
      document.documentElement.classList.remove('dark')
    }
  }, [state.kind, title, slug, t])

  const scene = useMemo(
    () => (state.kind === 'ok' ? parseScene(state.board.sceneJson) : { elements: [], files: {} }),
    [state],
  )

  if (state.kind === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center">
        <div className="h-10 w-48 rounded-md bg-white/5 animate-pulse" />
      </div>
    )
  }

  if (state.kind === 'error') {
    return (
      <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold mb-3">
          {state.status === 404 ? 'Board not found' : 'Could not load board'}
        </h1>
        <Link to="/welcome" className="text-sm text-zinc-300 underline underline-offset-4">
          {t('seo.goHome')}
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col">
      <header className="px-6 py-4 border-b border-white/10">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
      </header>
      <div className={`flex-1 min-h-0 ${EXCALIDRAW_MOUNT_CLASS}`} style={{ height: 'calc(100vh - 57px)' }}>
        <Excalidraw
          theme={EXCALIDRAW_THEME}
          UIOptions={EXCALIDRAW_UI_OPTIONS}
          viewModeEnabled
          initialData={{
            elements: scene.elements as never[],
            files: scene.files as never,
            appState: excalidrawSiteAppState(),
          }}
        />
      </div>
      <Link
        to="/welcome"
        className="fixed bottom-6 right-6 flex items-center gap-2 px-2 py-2 rounded-md border border-white/10 bg-black text-xs text-zinc-400 hover:text-white z-50"
      >
        {t('seo.madeWith')}
      </Link>
    </div>
  )
}
