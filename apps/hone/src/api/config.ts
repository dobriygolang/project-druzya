/** Empty in dev → same-origin requests hit Vite proxy (see vite.config.ts). */
const DEV_API_DEFAULT = '';
const PROD_API = 'https://druz9.online';

const envBase = (import.meta.env.VITE_DRUZ9_API_BASE as string | undefined)?.trim();

export const API_BASE_URL =
  envBase && envBase.length > 0
    ? envBase.replace(/\/$/, '')
    : import.meta.env.DEV
      ? DEV_API_DEFAULT
      : PROD_API;

export const WEB_BASE_URL =
  (import.meta.env.VITE_DRUZ9_WEB_BASE as string | undefined)?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:5173' : PROD_API);

export const DEV_BEARER_TOKEN: string | null =
  (import.meta.env.VITE_DRUZ9_DEV_TOKEN ?? '').trim() || null;
