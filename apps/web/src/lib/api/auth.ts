import { API_BASE, api, clearTokens, parseAuthTokens, persistTokens } from '@/lib/apiClient'
import { normalizeUser } from '@/lib/api/normalize'
import { normalizeProtoJson } from '@/lib/protoJson'
import type { AuthResponse, User } from '@/lib/types'

export type AuthConfig = {
  telegram_bot_username: string
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(`${API_BASE}/auth/config`, { method: 'GET' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`auth config ${res.status}: ${text}`)
  }
  const body = normalizeProtoJson(await res.json()) as AuthConfig & { telegram_bot_username?: string }
  return { telegram_bot_username: readTelegramBotUsername(body) }
}

function readTelegramBotUsername(cfg: AuthConfig & { telegramBotUsername?: string }): string {
  return cfg.telegram_bot_username || cfg.telegramBotUsername || ''
}

function mapAuthResponse(body: Record<string, unknown>): AuthResponse {
  const tokens = parseAuthTokens(body)
  const rawUser = (body.user ?? {}) as Record<string, unknown>
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    user: {
      id: String(rawUser.id ?? ''),
      username: String(rawUser.username ?? ''),
      avatar_url:
        typeof rawUser.avatar_url === 'string'
          ? rawUser.avatar_url
          : typeof rawUser.avatarUrl === 'string'
            ? rawUser.avatarUrl
            : undefined,
      created_at:
        typeof rawUser.created_at === 'string'
          ? rawUser.created_at
          : typeof rawUser.createdAt === 'string'
            ? rawUser.createdAt
            : undefined,
      telegram_id:
        rawUser.telegram_id != null
          ? String(rawUser.telegram_id)
          : rawUser.telegramId != null
            ? String(rawUser.telegramId)
            : undefined,
    },
  }
}

async function readAuthResponse(res: Response, errorPrefix: string): Promise<AuthResponse> {
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${errorPrefix} ${res.status}: ${text}`)
  }
  const body = normalizeProtoJson(await res.json()) as Record<string, unknown>
  const auth = mapAuthResponse(body)
  persistTokens(auth.access_token, auth.refresh_token)
  return auth
}

export async function authTelegram(code: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  })
  return readAuthResponse(res, 'telegram auth')
}

export async function getYandexAuthURL(): Promise<{ url: string; state: string }> {
  const res = await fetch(`${API_BASE}/auth/yandex/url`, { method: 'GET' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`yandex url ${res.status}: ${text}`)
  }
  return normalizeProtoJson(await res.json()) as { url: string; state: string }
}

export async function exchangeYandexCode(exchangeCode: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/yandex/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchange_code: exchangeCode }),
  })
  return readAuthResponse(res, 'yandex exchange')
}

export async function logout(): Promise<void> {
  const refresh = localStorage.getItem('druzya_refresh_token')
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh ?? '' }),
    })
  } catch {
    /* best effort */
  }
  clearTokens()
}

export async function getMe(): Promise<User> {
  const res = await api<{ user?: User }>('/me')
  return normalizeUser(res.user)
}
