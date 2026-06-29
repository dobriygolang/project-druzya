import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { useCallback, useRef } from 'react'
import {
  EXCALIDRAW_MOUNT_CLASS,
  EXCALIDRAW_THEME,
  EXCALIDRAW_UI_OPTIONS,
  excalidrawSiteAppState,
} from '@/components/system-design/excalidrawTheme'

export type ExcalidrawSceneAPI = {
  getSceneElements: () => readonly unknown[]
  getAppState: () => Record<string, unknown>
  getFiles: () => Record<string, unknown>
}

type Props = {
  initialData?: Record<string, unknown>
  onChange: (diagram: Record<string, unknown>) => void
  onApiReady?: (api: ExcalidrawSceneAPI) => void
}

/** Excalidraw wrapper — stores excalidraw JSON in workspace.diagram */
export function ExcalidrawCanvas({ initialData, onChange, onApiReady }: Props) {
  const apiRef = useRef<ExcalidrawSceneAPI | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onApiReadyRef = useRef(onApiReady)
  onApiReadyRef.current = onApiReady
  const rafRef = useRef(0)
  const pendingRef = useRef<Record<string, unknown> | null>(null)

  // initialData is mount-only — parent autosave must not feed updates back into Excalidraw.
  const initialElementsRef = useRef<{
    elements: unknown[]
    appState: ReturnType<typeof excalidrawSiteAppState>
  } | null>(null)
  if (!initialElementsRef.current) {
    const elements = initialData?.elements
    initialElementsRef.current = {
      elements: Array.isArray(elements) ? elements : [],
      appState: excalidrawSiteAppState(),
    }
  }

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      pendingRef.current = {
        elements: [...elements],
        appState: appState as Record<string, unknown>,
        files: files as Record<string, unknown>,
      }
      if (rafRef.current) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        const pending = pendingRef.current
        if (pending) onChangeRef.current(pending)
      })
    },
    [],
  )

  const handleApi = useCallback((api: unknown) => {
    const sceneApi = api as ExcalidrawSceneAPI
    apiRef.current = sceneApi
    onApiReadyRef.current?.(sceneApi)
  }, [])

  return (
    <div className={`${EXCALIDRAW_MOUNT_CLASS} h-full w-full`}>
      <Excalidraw
        theme={EXCALIDRAW_THEME}
        initialData={initialElementsRef.current as never}
        onChange={handleChange}
        excalidrawAPI={handleApi}
        UIOptions={EXCALIDRAW_UI_OPTIONS}
      />
    </div>
  )
}

export async function exportDiagramPngBase64(api: ExcalidrawSceneAPI | null): Promise<string | undefined> {
  if (!api) return undefined
  const elements = api.getSceneElements()
  if (elements.length === 0) return undefined
  const blob = await exportToBlob({
    elements,
    appState: api.getAppState(),
    files: api.getFiles(),
    mimeType: 'image/png',
  })
  return blobToBase64(blob)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('read failed'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}
