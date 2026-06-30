import type { ThemeId } from '@widgets/CanvasBg';

/** Excalidraw chrome — follows Hone theme, bottom toolbar only.
 *
 * Canvas fill is `appState.viewBackgroundColor` (not the `theme` prop).
 * In dark Excalidraw mode the canvas is inverted via CSS — store white (#fff).
 * In light mode white renders as-is.
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/initialdata
 */

export type ExcalidrawThemeMode = 'light' | 'dark';

/** Stored canvas fill — white in both modes (dark mode inverts it to ~#121212). */
export const HONE_EXCALIDRAW_CANVAS_BG = '#ffffff';

export const HONE_EXCALIDRAW_MOUNT_CLASS = 'hone-excalidraw-mount';

export const HONE_EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    changeViewBackgroundColor: false,
    clearCanvas: false,
    export: false,
    loadScene: false,
    saveToActiveFile: false,
    toggleTheme: false,
    saveAsImage: false,
  },
  tools: {
    image: true,
  },
} as const;

/** Map Hone canvas theme → Excalidraw UI theme. Light-palette themes use light mode. */
const LIGHT_EXCALIDRAW_THEMES: ReadonlyArray<ThemeId> = ['drift', 'visor'];

export function honeExcalidrawThemeFor(honeTheme: ThemeId): ExcalidrawThemeMode {
  return LIGHT_EXCALIDRAW_THEMES.includes(honeTheme) ? 'light' : 'dark';
}

/** initialData.appState — do not set `theme` here; use the `theme` prop instead. */
export function honeExcalidrawInitialAppState() {
  return {
    viewBackgroundColor: HONE_EXCALIDRAW_CANVAS_BG,
    showWelcomeScreen: false,
  };
}

/** Minimal patch for excalidrawAPI.updateScene after mount. */
export function honeExcalidrawCanvasPatch() {
  return {
    viewBackgroundColor: HONE_EXCALIDRAW_CANVAS_BG,
  };
}
