import { useEffect, useRef, useState } from 'react';

import type { TelegramStart } from '@shared/ipc';

import { API_BASE_URL } from '../api/config';
import { useSessionStore } from '../stores/session';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'awaiting'; flow: TelegramStart }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export function LoginScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [devUsername, setDevUsername] = useState('sergey');
  const [devBusy, setDevBusy] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const pollEpochRef = useRef(0);
  const cancelledRef = useRef(false);

  async function devLogin() {
    setDevBusy(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/auth/dev/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: devUsername.trim() || 'sergey' }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        setPhase({
          kind: 'error',
          message: resp.status === 404
            ? 'DEV_AUTH not enabled on backend'
            : `dev login: ${resp.status} ${txt.slice(0, 140)}`,
        });
        return;
      }
      const data = (await resp.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        user: { id: string };
      };
      useSessionStore.getState().hydrate({
        userId: data.user.id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      });
    } catch (e) {
      setPhase({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setDevBusy(false);
    }
  }

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    };
  }, []);

  const onSignIn = async () => {
    const bridge = window.hone;
    if (!bridge) {
      setPhase({ kind: 'error', message: 'Native bridge unavailable' });
      return;
    }
    setPhase({ kind: 'starting' });
    try {
      const flow = await bridge.auth.tgStart();
      setPhase({ kind: 'awaiting', flow });
      await window.hone?.shell.openExternal(flow.deepLink);
      startPolling(flow.code);
    } catch (e) {
      setPhase({
        kind: 'error',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  function startPolling(code: string) {
    pollEpochRef.current += 1;
    const epoch = pollEpochRef.current;
    const startedAt = Date.now();

    const tick = async () => {
      if (cancelledRef.current || pollEpochRef.current !== epoch) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPhase({ kind: 'error', message: 'Telegram bot did not respond in time' });
        return;
      }
      const bridge = window.hone;
      if (!bridge) return;

      try {
        const result = await bridge.auth.tgPoll(code);
        if (result.kind === 'ok') {
          useSessionStore.getState().hydrate({
            userId: result.session.userId,
            accessToken: result.session.accessToken,
            refreshToken: result.session.refreshToken,
            expiresAt: result.session.expiresAt,
          });
          return;
        }
        if (result.kind === 'expired') {
          setPhase({ kind: 'expired' });
          return;
        }
        if (result.kind === 'error') {
          setPhase({ kind: 'error', message: result.message });
          return;
        }
        if (result.kind === 'rate_limited') {
          pollTimer.current = window.setTimeout(tick, result.retryAfter * 1000);
          return;
        }
      } catch (e) {
        setPhase({
          kind: 'error',
          message: e instanceof Error ? e.message : String(e),
        });
        return;
      }

      pollTimer.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    };

    void tick();
  }

  return (
    <div className="login-screen">
      <h1 className="login-title">Hone</h1>
      <p className="login-sub">Sign in to sync tasks, notes, and focus sessions.</p>

      {phase.kind === 'idle' && (
        <button type="button" className="btn-primary" onClick={() => void onSignIn()}>
          Continue with Telegram
        </button>
      )}

      {phase.kind === 'starting' && <p className="login-hint">Starting…</p>}

      {phase.kind === 'awaiting' && (
        <div className="login-await">
          <p>Confirm in Telegram, then return here.</p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void window.hone?.shell.openExternal(phase.flow.deepLink)}
          >
            Open Telegram again
          </button>
        </div>
      )}

      {phase.kind === 'expired' && (
        <div className="login-await">
          <p>Code expired.</p>
          <button type="button" className="btn-primary" onClick={() => void onSignIn()}>
            Try again
          </button>
        </div>
      )}

      {phase.kind === 'error' && (
        <div className="login-await">
          <p className="login-error">{phase.message}</p>
          <button type="button" className="btn-primary" onClick={() => setPhase({ kind: 'idle' })}>
            Back
          </button>
        </div>
      )}

      {import.meta.env.DEV && (
        <div className="login-dev">
          <input
            value={devUsername}
            onChange={(e) => setDevUsername(e.target.value)}
            placeholder="dev username"
            aria-label="Dev username"
          />
          <button type="button" className="btn-ghost" disabled={devBusy} onClick={() => void devLogin()}>
            {devBusy ? '…' : 'Dev login'}
          </button>
        </div>
      )}
    </div>
  );
}
