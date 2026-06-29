// Single global transport: creating one per query would be a waste (each
// allocates headers maps + interceptor chain). Connect-Web transports are
// thread-safe by construction, so we memoise.
//
// Auth interceptor order:
//   1. dev-bearer hatch (VITE_DRUZ9_DEV_TOKEN) — useful before keychain
//      auth ships; flagged unused in prod.
//   2. session store bearer — populated after the keychain auth flow
//      completes. Empty until then → unauthenticated calls → the backend
//      returns Unauthenticated which the renderer surfaces as "log in".
import { createConnectTransport } from '@connectrpc/connect-web';
import { ConnectError, Code, type Interceptor } from '@connectrpc/connect';

import { API_BASE_URL, DEV_BEARER_TOKEN } from './config';
import { useSessionStore } from '../stores/session';
import { getDeviceId, clearDeviceId } from './device';

// Auth interceptor. Reads the token lazily on each call so a post-login
// rotation is picked up without rebuilding the transport.
const authInterceptor: Interceptor = (next) => async (req) => {
  const apply = () => {
    const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
    if (token) req.header.set('authorization', `Bearer ${token}`);
    else req.header.delete('authorization');
  };
  apply();
  const deviceId = getDeviceId();
  if (deviceId) {
    req.header.set('x-device-id', deviceId);
  }
  try {
    return await next(req);
  } catch (err) {
    // device_revoked — backend signal'ит что наш device disabled с
    // другого устройства. Wipe local state и отправляем юзера в логин.
    handleRevocation(err);
    // Auto-refresh on 401 — раньше: токен истёк → юзер видит «Sign in to
    // join the room» хотя у нас лежит валидный refresh_token. Теперь
    // ловим Unauthenticated, пытаемся обменять refresh→access, applies
    // новый token к req.header и retry'им один раз. Если refresh fails →
    // КРИТИЧНО force-clear сессию, чтобы App.tsx переключился на LoginScreen.
    // Раньше юзер застревал в `signed_in` с битым access+refresh токеном —
    // status === 'signed_in', но каждый RPC возвращает 401, login screen
    // не показывается. Теперь чистим, и App автоматом → LoginScreen.
    if (err instanceof ConnectError && err.code === Code.Unauthenticated) {
      const ok = await tryRefreshOnce();
      if (ok) {
        apply();
        return await next(req);
      }
      // Refresh не получился. Раньше: clear() для force re-login. Но
      // некоторые backend endpoints возвращают Unauthenticated на role-
      // mismatch (tutor-only RPC от user-role) — это НЕ auth-expiry,
      // одно failed RPC сносило всю сессию. Теперь clear только когда
      // backend explicit'но сказал что refresh is invalid (raw message
      // contains "refresh" / "session expired"); иначе просто бросаем
      // error и сессия живёт.
      const raw = err.rawMessage ?? '';
      const isAuthExpired =
        /refresh|session.*expired|token.*expired|invalid.*token/i.test(raw);
      const hadToken = !!useSessionStore.getState().accessToken;
      if (hadToken && isAuthExpired) {
        void useSessionStore.getState().clear();
      }
    }
    throw err;
  }
};

// Single in-flight refresh promise — concurrent 401's from parallel RPCs
// делают только один call к /Refresh. Resolve'ится true если access-token
// обновился, false если refresh не получился (нет refresh_token, server
// 401, network error).
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = useSessionStore.getState().refreshToken;
    if (!refresh) return false;
    try {
      const resp = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!resp.ok) return false;
      const j = (await resp.json()) as {
        accessToken?: string;
        access_token?: string;
        refreshToken?: string;
        refresh_token?: string;
        expiresIn?: number;
        expires_in?: number;
        user?: { id?: string };
      };
      const newAccess = j.accessToken ?? j.access_token;
      if (!newAccess) return false;
      const expiresIn = j.expiresIn ?? j.expires_in ?? 0;
      const newRefresh = j.refreshToken ?? j.refresh_token ?? refresh;
      const userId = j.user?.id ?? useSessionStore.getState().userId ?? '';
      useSessionStore.getState().hydrate({
        userId,
        accessToken: newAccess,
        refreshToken: newRefresh,
        expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : 0,
      });
      // Persist в keychain если bridge есть — иначе на следующий старт
      // всё ещё подсунем старый expired token.
      const bridge = typeof window !== 'undefined' ? window.hone : undefined;
      if (bridge?.auth?.persist) {
        try {
          await bridge.auth.persist({
            userId,
            accessToken: newAccess,
            refreshToken: newRefresh,
            expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : 0,
          });
        } catch {
          /* ignore — best-effort */
        }
      }
      return true;
    } catch {
      return false;
    }
  })();
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function handleRevocation(err: unknown): void {
  if (!(err instanceof ConnectError)) return;
  if (err.code !== Code.Unauthenticated) return;
  const raw = err.rawMessage ?? '';
  if (!raw.includes('device_revoked')) return;
  // Wipe local secrets — auth token + device id + sync cursor + IndexedDB
  // cache (privacy: revoke = data wipe). Session-store clear вернёт юзера
  // на LoginScreen (App.tsx подписан на accessToken).
  clearDeviceId();
  // Best-effort cache wipe + cursor clear. Lazy-import чтобы не тащить
  // IndexedDB/cursor код в hot transport path при каждом запуске.
  const userId = useSessionStore.getState().userId;
  void Promise.all([
    import('./sync').then(({ clearStoredCursor }) => clearStoredCursor()),
    userId
      ? import('./localCache').then(({ wipeCache }) => wipeCache(userId))
      : Promise.resolve(),
  ]).catch(() => {
    /* best-effort */
  });
  void useSessionStore.getState().clear();
}

export const transport = createConnectTransport({
  baseUrl: API_BASE_URL,
  // The monolith speaks Connect wire (binary + JSON). Default here is
  // JSON because it's the debugger-friendly one and the throughput cost
  // is immaterial for a desktop app doing ~dozens of requests/hour.
  useBinaryFormat: false,
  interceptors: [authInterceptor],
});
