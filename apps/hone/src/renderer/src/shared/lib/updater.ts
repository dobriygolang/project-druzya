import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type DownloadEvent } from '@tauri-apps/plugin-updater';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function readAppVersion(): Promise<string> {
  if (!isTauriRuntime()) return 'dev';
  return getVersion();
}

export type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'installing' | 'relaunching';

export type UpdateCheckResult =
  | { kind: 'unavailable' }
  | { kind: 'up_to_date' }
  | { kind: 'installed'; version: string }
  | { kind: 'error'; message: string };

export async function checkForUpdate(
  onPhase: (phase: UpdatePhase) => void,
  onProgress?: (downloaded: number, total: number | null) => void,
): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) return { kind: 'unavailable' };

  onPhase('checking');
  try {
    const update = await check();
    if (!update) {
      onPhase('idle');
      return { kind: 'up_to_date' };
    }

    onPhase('downloading');
    await update.downloadAndInstall((event: DownloadEvent) => {
      if (event.event === 'Started') {
        onProgress?.(0, event.data.contentLength ?? null);
      } else if (event.event === 'Progress') {
        onProgress?.(event.data.chunkLength, null);
      }
    });

    onPhase('relaunching');
    await relaunch();
    return { kind: 'installed', version: update.version };
  } catch (err) {
    onPhase('idle');
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'error', message };
  }
}
