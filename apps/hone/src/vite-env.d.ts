/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DRUZ9_API_BASE?: string;
  readonly VITE_DRUZ9_WEB_BASE?: string;
  readonly VITE_DRUZ9_DEV_TOKEN?: string;
  /** Dev login UI + API. Default: true in dev, false in prod build. */
  readonly VITE_HONE_DEV_LOGIN?: string;
  /** Use Vite proxy → localhost services (identity :8080, tracker :8089, …). */
  readonly VITE_HONE_LOCAL_API?: string;
  /** Fallback Telegram bot @username for login deep-link. */
  readonly VITE_TELEGRAM_BOT_USERNAME?: string;
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
