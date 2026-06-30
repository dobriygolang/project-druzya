import { normalizeProtoJson } from '@/lib/protoJson'
import { readStoredLocale } from '@/lib/i18n/localeStorage'

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '/v1'

export const ACCESS_TOKEN_KEY = 'druzya_access_token'
const REFRESH_TOKEN_KEY = 'druzya_refresh_token'
const REFRESH_LOCK_KEY = 'druzya_token_refresh_at'

let memAccessToken: string | null = null
let inflightRefresh: Promise<string | null> | null = null

const ACCESS_TOKEN_SKEW_MS = 30_000
const REFRESH_LOCK_STALE_MS = 15_000
const REFRESH_WAIT_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function decodeJwtExp(token: string): number | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(padded)) as { exp?: number }
    return typeof json.exp === 'number' ? json.exp : null
  } catch {
    return null
  }
}

function isAccessTokenFresh(token: string, skewMs = ACCESS_TOKEN_SKEW_MS): boolean {
  const exp = decodeJwtExp(token)
  if (!exp) return false
  return exp * 1000 > Date.now() + skewMs
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === ACCESS_TOKEN_KEY || event.key === REFRESH_TOKEN_KEY) {
      memAccessToken = safeRead(ACCESS_TOKEN_KEY)
    }
  })
}

function safeRead(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  } catch {
    /* noop */
  }
}

function safeDelete(key: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key)
  } catch {
    /* noop */
  }
}

export function readAccessToken(): string | null {
  const stored = safeRead(ACCESS_TOKEN_KEY)
  if (stored !== memAccessToken) memAccessToken = stored
  return memAccessToken
}

export function hasValidAccessToken(): boolean {
  const token = readAccessToken()
  return !!token && isAccessTokenFresh(token)
}

export function readRefreshToken(): string | null {
  return safeRead(REFRESH_TOKEN_KEY)
}

export function persistTokens(access: string, refresh: string | null): void {
  memAccessToken = access
  safeWrite(ACCESS_TOKEN_KEY, access)
  if (refresh) safeWrite(REFRESH_TOKEN_KEY, refresh)
}

export function clearTokens(): void {
  memAccessToken = null
  safeDelete(ACCESS_TOKEN_KEY)
  safeDelete(REFRESH_TOKEN_KEY)
}

/** grpc-gateway JSON uses camelCase; custom handlers may use snake_case. */
export function parseAuthTokens(body: Record<string, unknown>): {
  access_token: string
  refresh_token: string
} {
  const access = body.access_token ?? body.accessToken
  const refresh = body.refresh_token ?? body.refreshToken
  if (typeof access !== 'string' || !access) {
    throw new Error('missing access token in auth response')
  }
  return {
    access_token: access,
    refresh_token: typeof refresh === 'string' ? refresh : '',
  }
}


function redirectToLogin(): void {
  /* Auth removed from marketing site */
}

async function waitForCrossTabRefresh(): Promise<string | null> {
  const started = Date.now()
  while (Date.now() - started < REFRESH_WAIT_MS) {
    const lockAt = safeRead(REFRESH_LOCK_KEY)
    if (!lockAt) {
      const token = safeRead(ACCESS_TOKEN_KEY)
      return token && isAccessTokenFresh(token) ? token : null
    }
    const lockAge = Date.now() - Number(lockAt)
    if (Number.isNaN(lockAge) || lockAge > REFRESH_LOCK_STALE_MS) break
    const token = safeRead(ACCESS_TOKEN_KEY)
    if (token && isAccessTokenFresh(token)) {
      memAccessToken = token
      return token
    }
    await sleep(50)
  }
  return null
}

async function performRefresh(): Promise<string | null> {
  const refresh = readRefreshToken()
  if (!refresh) return null

  if (safeRead(REFRESH_LOCK_KEY)) {
    const waited = await waitForCrossTabRefresh()
    if (waited) return waited
  }

  safeWrite(REFRESH_LOCK_KEY, String(Date.now()))
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) {
      const waited = await waitForCrossTabRefresh()
      if (waited) return waited
      return null
    }
    const body = normalizeProtoJson(await res.json()) as Record<string, unknown>
    const tokens = parseAuthTokens(body)
    persistTokens(tokens.access_token, tokens.refresh_token || refresh)
    return tokens.access_token
  } catch {
    return null
  } finally {
    safeDelete(REFRESH_LOCK_KEY)
  }
}

/** Refresh access token when expired or close to expiry (e.g. WebSocket/LSP). */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const token = readAccessToken()
  if (token && isAccessTokenFresh(token)) return token
  return refreshAccessTokenOnce()
}

async function refreshAccessTokenOnce(): Promise<string | null> {
  if (inflightRefresh) return inflightRefresh
  inflightRefresh = performRefresh().finally(() => {
    inflightRefresh = null
  })
  return inflightRefresh
}

async function doFetch(path: string, init: RequestInit, bearer: string | null): Promise<Response> {
  const headers = new Headers(init.headers ?? undefined)
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json')
  }
  if (bearer) headers.set('authorization', `Bearer ${bearer}`)
  if (!headers.has('accept-language')) {
    headers.set('accept-language', readStoredLocale())
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}

export async function parseResponse<T>(path: string, res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  if (text.trimStart().startsWith('<')) {
    throw new ApiError(
      res.status,
      `API returned HTML instead of JSON for ${path} — check /v1 routing on reverse proxy`,
    )
  }
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new ApiError(res.status, text.slice(0, 500))
  }
  return normalizeProtoJson(body) as T
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`api ${status}: ${body}`)
  }
}

/** Human-readable message from ApiError JSON body or HTML misroute. */
export function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    const trimmed = err.body.trim()
    if (trimmed.startsWith('<')) {
      return 'API вернул HTML вместо JSON — проверь роутинг /v1 на прокси (Caddy).'
    }
    try {
      const parsed = JSON.parse(trimmed) as { error?: string; message?: string }
      if (parsed.error) return parsed.error
      if (parsed.message) return parsed.message
    } catch {
      /* plain text body */
    }
    if (trimmed) return trimmed
    return err.message
  }
  if (err instanceof Error) return err.message
  return 'Неизвестная ошибка'
}

/** API call with explicit bearer (e.g. guest scoped JWT). No refresh redirect. */
export async function apiWithBearer<T = unknown>(
  path: string,
  init: RequestInit,
  bearer: string,
): Promise<T> {
  const res = await doFetch(path, init, bearer)
  return parseResponse<T>(path, res)
}

export type ApiOptions = {
  /** When false, 401 throws ApiError without clearing tokens or redirecting to login. */
  redirectOnUnauthorized?: boolean
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
  options: ApiOptions = {},
): Promise<T> {
  const redirectOnUnauthorized = options.redirectOnUnauthorized !== false
  let token = readAccessToken()
  if (token && !isAccessTokenFresh(token)) {
    const refreshed = await refreshAccessTokenOnce()
    if (refreshed) token = refreshed
  }
  let res = await doFetch(path, init, token)

  const isAuthPath = path.startsWith('/auth/')
  if (res.status === 401 && !isAuthPath) {
    const nextToken = await refreshAccessTokenOnce()
    if (nextToken) {
      token = nextToken
      res = await doFetch(path, init, token)
    }
    if (res.status === 401) {
      if (redirectOnUnauthorized) {
        clearTokens()
        redirectToLogin()
      }
      throw new ApiError(401, 'unauthorized')
    }
  }

  return parseResponse<T>(path, res)
}
