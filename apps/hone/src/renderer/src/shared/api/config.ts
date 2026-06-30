// API config — project-druzya backend (same host as web in prod).
//
// Prod: https://druz9.online/v1/* (Caddy routes to microservices).
// Dev: empty base → same-origin Vite proxy (see vite.config.ts), or
// VITE_DRUZ9_API_BASE for direct localhost gateway.

/** Empty in dev → same-origin + Vite proxy. */
const DEV_API_DEFAULT = '';
const PROD_API = 'https://druz9.online';

const envBase = (import.meta.env.VITE_DRUZ9_API_BASE as string | undefined)?.trim();

export const API_BASE_URL =
  envBase && envBase.length > 0
    ? envBase.replace(/\/$/, '')
    : import.meta.env.DEV
      ? DEV_API_DEFAULT
      : PROD_API;

/** Fallback when /v1/auth/config is unavailable. */
export const TELEGRAM_BOT_USERNAME =
  (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined)?.trim() || 'druz9_bot';

// Публичный web — LoginScreen открывает `${WEB_BASE_URL}/login?desktop=…`
// в системном браузере для OAuth flow. В dev — локальный Vite (5173).
export const WEB_BASE_URL =
  (import.meta.env.VITE_DRUZ9_WEB_BASE as string | undefined)?.trim() ||
  (import.meta.env.DEV ? 'http://localhost:5173' : PROD_API);

// DEV_BEARER_TOKEN — хатч для debug'а без OAuth flow. В стандартном
// юзер-сценарии логин через LoginScreen → druz9://auth deep-link.
export const DEV_BEARER_TOKEN: string | null =
  (import.meta.env.VITE_DRUZ9_DEV_TOKEN ?? '').trim() || null;

// Pro-upgrade landing — открывается из UpgradeModal CTA в системном
// браузере. Backend на /upgrade редиректит в Stripe Checkout (см.
// `backend/services/subscription/` — уже implemented, мы тут только URL
// строим). Query params: `source=hone` для attribution + `feature=<slug>`
// для analytics («какой trigger чаще ведёт к конверсии»).
//
// `PRO_UPGRADE_URL_BASE` без trailing slash — UpgradeModal сам клеит
// `?source=hone&feature=<key>`. Override через VITE_DRUZ9_PRO_URL if needed.
export const PRO_UPGRADE_URL_BASE =
  (import.meta.env.VITE_DRUZ9_PRO_URL as string | undefined)?.trim() ||
  'https://druz9.online/pricing';

// BYOK landing — separate route чтобы юзер мог зайти, добавить API key
// своего провайдера (OpenAI/Anthropic/Groq/etc.) и Pro features unlock'нутся
// бесплатно. Web страница уже сделана, эта константа просто point'ит туда.
export const PRO_BYOK_URL =
  (import.meta.env.VITE_DRUZ9_BYOK_URL as string | undefined)?.trim() ||
  'https://druz9.online/byok';
