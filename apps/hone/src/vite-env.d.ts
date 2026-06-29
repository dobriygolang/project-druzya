/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DRUZ9_API_BASE?: string;
  readonly VITE_DRUZ9_WEB_BASE?: string;
  readonly VITE_DRUZ9_DEV_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import type { HoneAPI } from '@shared/ipc';
import type { StoreApi, UseBoundStore } from 'zustand';

declare global {
  interface Window {
    hone?: HoneAPI;
    __honeSession?: UseBoundStore<StoreApi<unknown>>;
  }
}

export {};
