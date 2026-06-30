import { API_BASE_URL } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';

export type AuthConfig = {
  telegram_bot_username: string;
};

function apiPath(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const res = await apiFetch(apiPath('/v1/auth/config'));
  if (!res.ok) {
    throw new Error(`auth config ${res.status}`);
  }
  const body = (await res.json()) as AuthConfig & { telegramBotUsername?: string };
  return {
    telegram_bot_username: body.telegram_bot_username || body.telegramBotUsername || '',
  };
}

export type AuthTelegramResult = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresAt: number;
};

function readJwtExpMs(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (typeof json.exp === 'number') return json.exp * 1000;
  } catch {
    /* ignore */
  }
  return 0;
}

export async function authTelegram(code: string): Promise<AuthTelegramResult> {
  const res = await apiFetch(apiPath('/v1/auth/telegram'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `telegram auth ${res.status}`);
  }

  const body = (await res.json()) as Record<string, unknown>;
  const accessToken = String(body.accessToken ?? body.access_token ?? '');
  const refreshToken = String(body.refreshToken ?? body.refresh_token ?? '');
  const user = (body.user ?? {}) as Record<string, unknown>;
  const userId = String(user.id ?? '');

  if (!accessToken || !userId) {
    throw new Error('invalid auth response');
  }

  const expiresAt = readJwtExpMs(accessToken) || Date.now() + 15 * 60 * 1000;
  return { accessToken, refreshToken, userId, expiresAt };
}
