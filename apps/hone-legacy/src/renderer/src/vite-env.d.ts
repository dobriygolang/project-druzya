/// <reference types="vite/client" />

import type { HoneAPI } from '@shared/ipc';

// The preload script mounts the typed API at window.hone via contextBridge.
// Declaring it here keeps renderer code free of `any` casts without having
// to import the IPC types at every use site.
//
// __honeIPC — narrow side-channel bridge used by features (day-shutdown,
// energy-nudge, etc.) that route through generic invoke/on channels instead
// of the typed HoneAPI. Optional because older preload builds may not expose
// it — call sites guard with `if (!ipc) return null`.
//
// __honeSession — dev/HMR helper: stores the zustand session-store so a
// reload doesn't lose the in-memory auth state during local development.
declare global {
  interface Window {
    hone: HoneAPI;
    __honeIPC?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (channel: string, listener: () => void) => () => void;
    };
    __honeSession?: unknown;
  }
}

export {};
