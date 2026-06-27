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

function isPublicPath(path: string): boolean {
  return path.startsWith('/login') || path.startsWith('/auth/')
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
    const body = (await res.json()) as {
      access_token?: string
      refresh_token?: string
    }
    if (!body.access_token) return null
    persistTokens(body.access_token, body.refresh_token ?? refresh)
    return body.access_token
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

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`api ${status}: ${body}`)
  }
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

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(res.status, body)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}
