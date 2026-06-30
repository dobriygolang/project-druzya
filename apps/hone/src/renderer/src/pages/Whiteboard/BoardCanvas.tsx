import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CaptureUpdateAction, Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

import {
  parseSceneJson,
  serializeScene,
  type WhiteboardScene,
} from '@features/whiteboard/repository/whiteboardStore';
import {
  HONE_EXCALIDRAW_CANVAS_BG,
  HONE_EXCALIDRAW_MOUNT_CLASS,
  HONE_EXCALIDRAW_UI_OPTIONS,
  honeExcalidrawCanvasPatch,
  honeExcalidrawInitialAppState,
  honeExcalidrawThemeFor,
} from '@shared/lib/excalidraw/honeTheme';
import type { ThemeId } from '@widgets/CanvasBg';
import {
  mergePersistedAppState,
  sanitizeAppStateForPersistence,
} from '@shared/lib/excalidraw/excalidrawPersist';

const SAVE_DEBOUNCE_MS = 1500;

type ExcalidrawApi = {
  updateScene: (scene: {
    appState?: Record<string, unknown>;
    captureUpdate?: (typeof CaptureUpdateAction)[keyof typeof CaptureUpdateAction];
  }) => void;
  getAppState: () => { viewBackgroundColor?: string; isLoading?: boolean };
};

export type BoardCanvasHandle = {
  flush: () => Promise<void>;
  /** Cancel pending autosave — call before deleting the open board. */
  prepareDelete: () => void;
  getSceneJson: () => string;
};

interface BoardCanvasProps {
  boardId: string;
  sceneJson: string;
  appTheme: ThemeId;
  onSaved: () => void;
  onSaveError: (msg: string) => void;
}

function buildInitialData(sceneJson: string) {
  const parsed = parseSceneJson(sceneJson);
  return {
    elements: parsed?.elements ?? [],
    files: parsed?.files ?? {},
    appState: mergePersistedAppState(honeExcalidrawInitialAppState(), parsed?.appState),
  };
}

export const BoardCanvas = forwardRef<BoardCanvasHandle, BoardCanvasProps>(function BoardCanvas(
  { boardId, sceneJson, appTheme, onSaved, onSaveError },
  ref,
) {
  const sceneRef = useRef<WhiteboardScene | null>(null);
  const appStateRef = useRef<Record<string, unknown>>({});
  const skipSaveRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawApi | null>(null);
  const onSavedRef = useRef(onSaved);
  const onSaveErrorRef = useRef(onSaveError);
  onSavedRef.current = onSaved;
  onSaveErrorRef.current = onSaveError;

  const initialData = useMemo(() => buildInitialData(sceneJson), [boardId, sceneJson]);

  const flushSave = useCallback(async () => {
    if (skipSaveRef.current) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const { updateBoardScene } = await import('@features/whiteboard/api/whiteboardClient');
    try {
      await updateBoardScene(boardId, serializeScene(scene));
      onSavedRef.current();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onSaveErrorRef.current(msg);
    }
  }, [boardId]);

  const prepareDelete = useCallback(() => {
    skipSaveRef.current = true;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      flush: flushSave,
      prepareDelete,
      getSceneJson: () => {
        const scene = sceneRef.current;
        if (!scene) return sceneJson;
        return serializeScene(scene);
      },
    }),
    [flushSave, prepareDelete, sceneJson],
  );

  const applyCanvasBackground = useCallback((api: ExcalidrawApi) => {
    api.updateScene({
      appState: honeExcalidrawCanvasPatch(),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  }, []);

  useEffect(() => {
    skipSaveRef.current = true;
    setExcalidrawApi(null);
    sceneRef.current = {
      elements: initialData.elements,
      files: initialData.files,
      appState: initialData.appState,
    };
    const readyTimer = window.setTimeout(() => {
      skipSaveRef.current = false;
    }, 120);
    return () => {
      window.clearTimeout(readyTimer);
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      void flushSave();
    };
  }, [boardId, initialData, flushSave]);

  // Docs: set viewBackgroundColor via updateScene after init; wait out isLoading.
  // https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api
  useEffect(() => {
    if (!excalidrawApi) return;

    let cancelled = false;
    const patch = () => {
      if (cancelled) return;
      applyCanvasBackground(excalidrawApi);
    };

    patch();

    if (excalidrawApi.getAppState().isLoading) {
      const poll = window.setInterval(() => {
        if (cancelled) return;
        if (!excalidrawApi.getAppState().isLoading) {
          window.clearInterval(poll);
          patch();
        }
      }, 50);
      return () => {
        cancelled = true;
        window.clearInterval(poll);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [excalidrawApi, boardId, applyCanvasBackground]);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (skipSaveRef.current) return;
      appStateRef.current = sanitizeAppStateForPersistence(
        (appState as Record<string, unknown>) ?? {},
      ) ?? { viewBackgroundColor: HONE_EXCALIDRAW_CANVAS_BG };
      sceneRef.current = {
        elements: [...elements],
        files: (files as Record<string, unknown>) ?? {},
        appState: appStateRef.current,
      };
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void flushSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [flushSave],
  );

  const excalidrawTheme = honeExcalidrawThemeFor(appTheme);

  return (
    <div className={`${HONE_EXCALIDRAW_MOUNT_CLASS} hone-whiteboard-canvas`}>
      <Excalidraw
        key={boardId}
        theme={excalidrawTheme}
        initialData={{
          elements: initialData.elements as never[],
          files: initialData.files as never,
          appState: initialData.appState as never,
        }}
        onChange={handleChange}
        excalidrawAPI={(api) => setExcalidrawApi(api as ExcalidrawApi)}
        UIOptions={HONE_EXCALIDRAW_UI_OPTIONS}
        aiEnabled={false}
        renderTopRightUI={() => null}
      />
    </div>
  );
});
