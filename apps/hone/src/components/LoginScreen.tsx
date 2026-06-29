import { useEffect, useRef, useState } from 'react';

import type { TelegramStart } from '@shared/ipc';

import { API_BASE_URL } from '../api/config';
import { DEV_LOGIN_ENABLED } from '../features';
import { useSessionStore } from '../stores/session';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'awaiting'; flow: TelegramStart }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

function TelegramIcon(): JSX.Element {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#229ED9"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
      />
    </svg>
  );
}

export function LoginScreen(): JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [devUsername, setDevUsername] = useState('sergey');
  const [devBusy, setDevBusy] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const pollEpochRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    };
  }, []);

  async function devLogin(): Promise<void> {
    setDevBusy(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/auth/dev/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: devUsername.trim() || 'sergey' }),
      });
      if (!resp.ok) {
        setPhase({
          kind: 'error',
          message: resp.status === 404
            ? 'DEV_AUTH not enabled on backend'
            : `Dev login failed (${resp.status})`,
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

  const onSignIn = async (): Promise<void> => {
    const bridge = window.hone;
    if (!bridge) {
      setPhase({ kind: 'error', message: 'Sign in requires the Hone desktop app' });
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

  function startPolling(code: string): void {
    pollEpochRef.current += 1;
    const epoch = pollEpochRef.current;
    const startedAt = Date.now();

    const tick = async (): Promise<void> => {
      if (cancelledRef.current || pollEpochRef.current !== epoch) return;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPhase({ kind: 'error', message: 'Telegram did not respond in time' });
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

  const busy = phase.kind === 'starting' || phase.kind === 'awaiting';
  const statusText =
    phase.kind === 'starting'
      ? 'Opening Telegram…'
      : phase.kind === 'awaiting'
        ? 'Confirm in the bot, then return here'
        : phase.kind === 'expired'
          ? 'Code expired'
          : phase.kind === 'error'
            ? phase.message
            : null;

  const handlePrimary = (): void => {
    if (phase.kind === 'awaiting') {
      void window.hone?.shell.openExternal(phase.flow.deepLink);
      return;
    }
    if (phase.kind === 'idle' || phase.kind === 'expired' || phase.kind === 'error') {
      void onSignIn();
    }
  };

  return (
    <div className="login-screen">
      <div className="login-stack">
        <h1 className="login-brand">Hone</h1>
        <span className="login-rule" aria-hidden />

        <button
          type="button"
          className="login-tg-btn"
          onClick={handlePrimary}
          disabled={busy && phase.kind === 'starting'}
          aria-label="Continue with Telegram"
        >
          <TelegramIcon />
        </button>

        {statusText && (
          <p className={phase.kind === 'error' ? 'login-status login-status--error' : 'login-status'}>
            {statusText}
          </p>
        )}
      </div>

      {DEV_LOGIN_ENABLED && (
        <form
          className="login-dev"
          onSubmit={(e) => {
            e.preventDefault();
            void devLogin();
          }}
        >
          <input
            className="login-dev-input"
            value={devUsername}
            onChange={(e) => setDevUsername(e.target.value)}
            placeholder="username"
            aria-label="Dev username"
            autoComplete="username"
          />
          <button type="submit" className="login-dev-btn" disabled={devBusy}>
            {devBusy ? '…' : 'Dev'}
          </button>
        </form>
      )}
    </div>
  );
}
