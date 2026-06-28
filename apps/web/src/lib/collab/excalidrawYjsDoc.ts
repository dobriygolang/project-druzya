import * as Y from 'yjs'

export type ScenePayload = {
  elements: unknown[]
  files: Record<string, unknown>
}

const ELEM_MAP = 'elements'
const ORDER_ARR = 'elementIds'
const FILES_MAP = 'files'
const LEGACY_TEXT = 'scene'

export type ExcalidrawYjsDoc = {
  elementsMap: Y.Map<string>
  elementIds: Y.Array<string>
  filesMap: Y.Map<string>
  legacyText: Y.Text
}

export function bindExcalidrawYjsDoc(ydoc: Y.Doc): ExcalidrawYjsDoc {
  return {
    elementsMap: ydoc.getMap<string>(ELEM_MAP),
    elementIds: ydoc.getArray<string>(ORDER_ARR),
    filesMap: ydoc.getMap<string>(FILES_MAP),
    legacyText: ydoc.getText(LEGACY_TEXT),
  }
}

function elementId(el: unknown): string | null {
  if (!el || typeof el !== 'object') return null
  const id = (el as { id?: unknown }).id
  return typeof id === 'string' && id.length > 0 ? id : null
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function readSceneFromYjs(ydoc: Y.Doc): ScenePayload {
  const { elementsMap, elementIds, filesMap } = bindExcalidrawYjsDoc(ydoc)
  const order = elementIds.toArray()
  const seen = new Set<string>()
  const elements: unknown[] = []

  for (const id of order) {
    const raw = elementsMap.get(id)
    if (!raw) continue
    try {
      elements.push(JSON.parse(raw))
      seen.add(id)
    } catch {
      /* skip corrupt entry */
    }
  }

  elementsMap.forEach((raw, id) => {
    if (seen.has(id)) return
    try {
      elements.push(JSON.parse(raw))
    } catch {
      /* skip */
    }
  })

  const files: Record<string, unknown> = {}
  filesMap.forEach((raw, id) => {
    try {
      files[id] = JSON.parse(raw)
    } catch {
      files[id] = raw
    }
  })

  return { elements, files }
}

export function writeSceneToYjs(
  ydoc: Y.Doc,
  elements: readonly unknown[],
  files: Record<string, unknown>,
  origin?: unknown,
): void {
  ydoc.transact(() => {
    const { elementsMap, elementIds, filesMap } = bindExcalidrawYjsDoc(ydoc)
    const nextIds = new Set<string>()

    for (const el of elements) {
      const id = elementId(el)
      if (!id) continue
      nextIds.add(id)
      const serialized = JSON.stringify(el)
      if (elementsMap.get(id) !== serialized) {
        elementsMap.set(id, serialized)
      }
    }

    for (const id of Array.from(elementsMap.keys())) {
      if (!nextIds.has(id)) elementsMap.delete(id)
    }

    const desiredOrder: string[] = []
    for (const el of elements) {
      const id = elementId(el)
      if (id) desiredOrder.push(id)
    }
    const currentOrder = elementIds.toArray()
    if (!arraysEqual(currentOrder, desiredOrder)) {
      elementIds.delete(0, elementIds.length)
      if (desiredOrder.length > 0) elementIds.insert(0, desiredOrder)
    }

    const nextFileIds = new Set(Object.keys(files))
    for (const id of Array.from(filesMap.keys())) {
      if (!nextFileIds.has(id)) filesMap.delete(id)
    }
    for (const [id, file] of Object.entries(files)) {
      const serialized = JSON.stringify(file)
      if (filesMap.get(id) !== serialized) filesMap.set(id, serialized)
    }
  }, origin)
}

/** One-time import from legacy Y.Text('scene') blob used in early collab builds. */
export function migrateLegacySceneText(ydoc: Y.Doc): void {
  const { legacyText, elementsMap } = bindExcalidrawYjsDoc(ydoc)
  if (elementsMap.size > 0 || legacyText.length === 0) return
  try {
    const parsed = JSON.parse(legacyText.toString()) as {
      elements?: unknown[]
      files?: Record<string, unknown>
    }
    writeSceneToYjs(ydoc, parsed.elements ?? [], parsed.files ?? {}, 'migrate')
    legacyText.delete(0, legacyText.length)
  } catch {
    legacyText.delete(0, legacyText.length)
  }
}

export function sceneHasContent(ydoc: Y.Doc): boolean {
  const { elementsMap, legacyText } = bindExcalidrawYjsDoc(ydoc)
  return elementsMap.size > 0 || legacyText.length > 0
}

export function observeSceneChanges(
  ydoc: Y.Doc,
  onChange: (scene: ScenePayload) => void,
): () => void {
  let raf = 0

  const schedule = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      raf = 0
      onChange(readSceneFromYjs(ydoc))
    })
  }

  const onAfterTransaction = (tr: Y.Transaction) => {
    // Skip echoes from this client's own writes (origin set in writeSceneToYjs).
    if (tr.origin === 'local') return
    schedule()
  }

  ydoc.on('afterTransaction', onAfterTransaction)

  return () => {
    if (raf) cancelAnimationFrame(raf)
    ydoc.off('afterTransaction', onAfterTransaction)
  }
}

export function sceneToJSON(ydoc: Y.Doc): string {
  const scene = readSceneFromYjs(ydoc)
  return JSON.stringify(scene)
}
