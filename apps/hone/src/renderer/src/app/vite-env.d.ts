/// <reference types="vite/client" />

import type { HoneAPI } from '@platform/ipc';

declare global {
  interface Window {
    hone: HoneAPI;
    __honeSession?: unknown;
  }
}

export {};
