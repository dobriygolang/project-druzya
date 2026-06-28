import { normalizeProtoJson } from '@/lib/protoJson'

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? '/v1'

const ACCESS_TOKEN_KEY = 'druzya_access_token'
const REFRESH_TOKEN_KEY = 'druzya_refresh_token'

let memAccessToken: string | null = null
let inflightRefresh: Promise<string | null> | null = null

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
  if (memAccessToken) return memAccessToken
  memAccessToken = safeRead(ACCESS_TOKEN_KEY)
  return memAccessToken
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

function isPublicPath(path: string): boolean {
  return path.startsWith('/login') || path.startsWith('/auth/') || path.startsWith('/live/')
}

function redirectToLogin(): void {
  if (typeof window === 'undefined' || isPublicPath(window.location.pathname)) return
  const next = encodeURIComponent(window.location.pathname + window.location.search)
  window.location.href = `/login?next=${next}`
}

async function performRefresh(): Promise<string | null> {
  const refresh = readRefreshToken()
  if (!refresh) return null
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) return null
    const body = normalizeProtoJson(await res.json()) as Record<string, unknown>
    const tokens = parseAuthTokens(body)
    persistTokens(tokens.access_token, tokens.refresh_token || refresh)
    return tokens.access_token
  } catch {
    return null
  }
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
  return fetch(`${API_BASE}${path}`, { ...init, headers })
}

async function parseResponse<T>(path: string, res: Response): Promise<T> {
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

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  let token = readAccessToken()
  let res = await doFetch(path, init, token)

  const isAuthPath = path.startsWith('/auth/')
  if (res.status === 401 && !isAuthPath) {
    const nextToken = await refreshAccessTokenOnce()
    if (nextToken) {
      token = nextToken
      res = await doFetch(path, init, token)
    }
    if (res.status === 401) {
      clearTokens()
      redirectToLogin()
      throw new ApiError(401, 'unauthorized')
    }
  }

  return parseResponse<T>(path, res)
}
