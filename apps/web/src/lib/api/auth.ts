import { API_BASE, api, clearTokens, persistTokens } from '@/lib/apiClient'
import type { AuthResponse, User } from '@/lib/types'

export async function authTelegram(code: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code.trim() }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`telegram auth ${res.status}: ${text}`)
  }
  const body = (await res.json()) as AuthResponse
  persistTokens(body.access_token, body.refresh_token)
  return body
}

export async function getYandexAuthURL(): Promise<{ url: string; state: string }> {
  const res = await fetch(`${API_BASE}/auth/yandex/url`, { method: 'GET' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`yandex url ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ url: string; state: string }>
}

export async function exchangeYandexCode(exchangeCode: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/yandex/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exchange_code: exchangeCode }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`yandex exchange ${res.status}: ${text}`)
  }
  const body = (await res.json()) as AuthResponse
  persistTokens(body.access_token, body.refresh_token)
  return body
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
  const res = await api<{ user: User }>('/me')
  return res.user
}
