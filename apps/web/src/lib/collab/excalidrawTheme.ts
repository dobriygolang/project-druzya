/** Shared Excalidraw chrome — matches site tokens in main.css */

export const EXCALIDRAW_MOUNT_CLASS = 'druzya-excalidraw'

export const EXCALIDRAW_SITE_COLORS = {
  canvas: '#fafaf8',
} as const

export const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: { loadScene: false, export: false },
} as const

export const EXCALIDRAW_THEME = 'light' as const

export function excalidrawSiteAppState() {
  return {
    viewBackgroundColor: EXCALIDRAW_SITE_COLORS.canvas,
    theme: EXCALIDRAW_THEME,
  }
}
