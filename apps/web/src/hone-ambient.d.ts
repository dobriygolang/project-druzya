/** Minimal stubs so web typecheck can compile Hone renderer imports without Tauri installed. */
declare module '@tauri-apps/api/core' {
  export function invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

declare module '@tauri-apps/api/event' {
  export type UnlistenFn = () => void;
  export function listen<T>(
    event: string,
    handler: (event: { payload: T }) => void,
  ): Promise<UnlistenFn>;
}

declare module '@tauri-apps/api/app' {
  export function getVersion(): Promise<string>;
}

declare module '@tauri-apps/plugin-process' {
  export function relaunch(): Promise<void>;
}

declare module '@tauri-apps/plugin-updater' {
  export interface DownloadEvent {
    event: string;
    data: {
      contentLength?: number | null;
      chunkLength?: number;
    };
  }

  export interface Update {
    version: string;
    downloadAndInstall(onEvent: (event: DownloadEvent) => void): Promise<void>;
  }

  export function check(): Promise<Update | null>;
}

export {};
