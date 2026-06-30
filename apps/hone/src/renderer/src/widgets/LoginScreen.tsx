import { useEffect, useState } from 'react';

import { authTelegram, getAuthConfig } from '@features/auth/api/auth';
import { API_BASE_URL, TELEGRAM_BOT_USERNAME } from '@shared/api/config';
import { DEV_LOGIN_ENABLED } from '@app/config/features';
import { useSessionStore } from '@shared/model/session';

function TelegramIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden focusable="false" className="login-tg-icon">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 0 0-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"
      />
    </svg>
  );
}

async function persistSession(session: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}): Promise<void> {
  useSessionStore.getState().hydrate(session);
  if (window.hone) {
    await window.hone.auth.persist(session);
  }
}

export function LoginScreen(): JSX.Element {
  const [code, setCode] = useState('');
  const [botUsername, setBotUsername] = useState(TELEGRAM_BOT_USERNAME);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devUsername, setDevUsername] = useState('sergey');
  const [devBusy, setDevBusy] = useState(false);

  useEffect(() => {
    getAuthConfig()
      .then((cfg) => {
        if (cfg.telegram_bot_username) setBotUsername(cfg.telegram_bot_username);
      })
      .catch(() => {});
  }, []);

  const botLink = botUsername ? `https://t.me/${botUsername}?start=login` : null;

  async function openBot(): Promise<void> {
    if (!botLink) return;
    const bridge = window.hone;
    if (bridge) {
      await bridge.shell.openExternal(botLink);
    } else {
      window.open(botLink, '_blank', 'noopener,noreferrer');
    }
  }

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = code.trim();

    if (!trimmed) {
      if (!botLink) {
        setError('Бот не настроен');
        return;
      }
      setError(null);
      await openBot();
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const auth = await authTelegram(trimmed);
      await persistSession({
        userId: auth.userId,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
        expiresAt: auth.expiresAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  }

  const hasCode = code.trim().length > 0;

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
        setError(
          resp.status === 404
            ? 'DEV_AUTH not enabled on backend'
            : `Dev login failed (${resp.status})`,
        );
        return;
      }
      const data = (await resp.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        user: { id: string };
      };
      await persistSession({
        userId: data.user.id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDevBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-stack">
        <h1 className="login-brand">FRIENDS</h1>
        <span className="login-rule" aria-hidden />

        <form className="login-form" onSubmit={(e) => void onSubmit(e)}>
          <p className="login-hint">
            {botLink
              ? 'Открой бота, получи код и вставь его сюда.'
              : 'Открой Telegram-бота, отправь /start login и введи код.'}
          </p>

          <input
            id="tg-code"
            className="login-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD1234"
            autoComplete="one-time-code"
            maxLength={16}
            aria-label="Код из Telegram"
            disabled={busy}
          />

          <button
            type="submit"
            className="login-tg-btn"
            disabled={busy}
            aria-label={hasCode ? 'Войти с кодом' : 'Открыть Telegram-бота'}
          >
            <TelegramIcon />
          </button>

          {error && <p className="login-status login-status--error">{error}</p>}
        </form>
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
