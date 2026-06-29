// LoginScreen — показывается когда session.status === 'guest'.
//
// Telegram code-flow прямо через main-process: никаких /login web-страниц,
// никаких druz9:// custom-scheme прыжков. Hone main fetch'ает
// /auth/telegram/start, открывает t.me/<bot>?start=<code>, polling'ит до
// confirmation, сохраняет сессию в keychain, broadcast'ит authChanged —
// renderer хидрейтится сам.
//
// Старый flow («открой web /login → druz9://auth») удалён: Chrome блокировал
// custom-scheme redirect из async-контекста, в dev Electron вообще не
// регистрировал druz9:// в LaunchServices, итого «логонюсь и ничего не
import { useEffect, useRef, useState } from 'react';

import { useT, translate } from '@d9-i18n';

import type { TelegramStart } from '@shared/ipc';
import { Wordmark } from './Chrome';
import { useSessionStore } from '../stores/session';
import { API_BASE_URL } from '../api/config';

const POLL_INTERVAL_MS = 2000;
// Max time юзер может ждать в `awaiting` перед тем как мы скажем «бот не
// отвечает». Раньше polling шёл indefinitely → юзер тыкал в бота, бот
// почему-то не fill'ил code (webhook misconfig / token revoked / etc),
// и приложение молча polling'ало вечно. Теперь через 2 минуты — явное
// «Bot didn't respond» с retry button'ом.
const POLL_TIMEOUT_MS = 120_000;

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'awaiting'; flow: TelegramStart }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export function LoginScreen() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [devUsername, setDevUsername] = useState('sergey');
  const [devBusy, setDevBusy] = useState(false);
  const pollTimer = useRef<number | null>(null);
  const pollEpochRef = useRef(0);
  const cancelledRef = useRef(false);

  // Dev login: hits POST /api/v1/auth/dev/login when DEV_AUTH=true on
  // backend. INSECURE — bypass'ом TG-flow для local testing. Production
  // backend без DEV_AUTH=true вернёт 404 — кнопка просто не сработает.
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
        if (resp.status === 404) {
          setPhase({ kind: 'error', message: 'DEV_AUTH not enabled on backend (set DEV_AUTH=true in .env)' });
          return;
        }
        const txt = await resp.text();
        setPhase({ kind: 'error', message: `dev login: ${resp.status} ${txt.slice(0, 140)}` });
        return;
      }
      const data = (await resp.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        user: { id: string };
      };
      // Hone main-process owns the session keychain in production. Для
      // dev-flow обходим main и hydrate'им store напрямую — main IPC
      // sync на следующей page load всё равно подхватит.
      useSessionStore.getState().hydrate({
        userId: data.user.id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      });
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
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
      setPhase({ kind: 'error', message: 'Hone bridge unavailable (running in browser?)' });
      return;
    }
    setPhase({ kind: 'starting' });
    try {
      const flow = await bridge.auth.tgStart();
      // Open the bot deep-link in the system browser. macOS / iOS / Android
      // catch the t.me/* link and hand it to the Telegram app if installed.
      await bridge.shell.openExternal(flow.deepLink);
      setPhase({ kind: 'awaiting', flow });
      pollLoop(flow.code);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPhase({ kind: 'error', message: msg });
    }
  };

  const pollLoop = (code: string) => {
    // Kill any in-flight ticks от прошлых attempt'ов. Если юзер кликнул
    // Sign In дважды быстро (или React StrictMode double-mount'нул), могла
    // получиться race: tick-A polls для code-A, tick-B polls для code-B,
    // оба переписывают pollTimer.current, в итоге один из них продолжает
    // тикать с stale code'ом и никогда не получит 'ok'.
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    // Per-call cancel-token — если pollLoop вызвался ещё раз с новым code'ом,
    // старый цикл проверит свой токен и завершится.
    const myEpoch = ++pollEpochRef.current;
    const startedAt = Date.now();
    const tick = async () => {
      const bridge = window.hone;
      if (!bridge || cancelledRef.current) return;
      // Stale tick — другой pollLoop запущен после нас.
      if (myEpoch !== pollEpochRef.current) return;
      // Hard timeout — bot не отвечает уже 2 минуты, не tease'им юзера.
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setPhase({
          kind: 'error',
          message: translate('hone.auth.bot_timeout'),
        });
        return;
      }
      const result = await bridge.auth.tgPoll(code);
      if (cancelledRef.current) return;
      switch (result.kind) {
        case 'ok':
          // Direct hydrate — НЕ полагаемся на authChanged IPC event'у. Был
          // bug: backend возвращал 200, main сохранял session, broadcast'ил
          // authChanged, но renderer'овский listener почему-то не срабатывал
          // (race с unmount/remount?), юзер застревал в "Waiting for
          // confirmation…" хотя по логам всё успешно. Hydrate напрямую из
          // result.session — failsafe, не зависит от IPC bus'а.
          if (result.session && result.session.accessToken) {
            useSessionStore.getState().hydrate({
              userId: result.session.userId,
              accessToken: result.session.accessToken,
              refreshToken: result.session.refreshToken ?? undefined,
              expiresAt: result.session.expiresAt,
            });
          }
          setPhase({ kind: 'idle' });
          return;
        case 'pending':
          pollTimer.current = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
          return;
        case 'expired':
          setPhase({ kind: 'expired' });
          return;
        case 'rate_limited':
          // Backoff to whatever the server told us, fall back to default.
          pollTimer.current = window.setTimeout(
            () => void tick(),
            Math.max(result.retryAfter * 1000, POLL_INTERVAL_MS),
          );
          return;
        case 'error':
          setPhase({ kind: 'error', message: result.message });
          return;
      }
    };
    pollTimer.current = window.setTimeout(() => void tick(), POLL_INTERVAL_MS);
  };

  const cancelFlow = () => {
    if (pollTimer.current !== null) window.clearTimeout(pollTimer.current);
    pollTimer.current = null;
    setPhase({ kind: 'idle' });
  };

  return (
    <div
      className="motion-page-in"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <Wordmark />
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: '0 32px' }}>
        <div style={captionMonoSmall}>{t('hone.auth.eyebrow')}</div>
        <h1
          style={{
            margin: '22px 0 12px',
            fontSize: 'var(--type-h1-size)',
            lineHeight: 'var(--type-h1-lh)',
            letterSpacing: 'var(--type-h1-ls)',
            fontWeight: 'var(--type-h1-weight)',
            color: 'var(--ink)',
          }}
        >
          {t('hone.auth.headline')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--type-body-size)',
            lineHeight: 'var(--type-body-lh)',
            color: 'var(--ink-60)',
            maxWidth: '60ch',
            marginInline: 'auto',
          }}
        >
          {t('hone.auth.body')}
        </p>

        {phase.kind === 'awaiting' ? (
          <AwaitingPanel flow={phase.flow} onCancel={cancelFlow} />
        ) : (
          <button
            onClick={() => void onSignIn()}
            disabled={phase.kind === 'starting'}
            className="focus-ring motion-press"
            style={{
              marginTop: 32,
              padding: '11px 24px',
              borderRadius: 'var(--radius-inner)',
              background: phase.kind === 'starting' ? 'transparent' : 'var(--ink)',
              border: phase.kind === 'starting' ? '1px solid var(--hair-2)' : '0',
              color: phase.kind === 'starting' ? 'var(--ink-60)' : 'var(--bg)',
              fontSize: 14,
              fontWeight: 500,
              cursor: phase.kind === 'starting' ? 'progress' : 'pointer',
              transition:
                'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
            }}
          >
            {phase.kind === 'starting' ? t('hone.auth.cta.connecting') : t('hone.auth.cta.sign_in')}
          </button>
        )}

        {phase.kind === 'expired' && (
          <p
            style={{
              marginTop: 18,
              ...captionMonoSmall,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: 1.5, background: 'var(--red)' }} />
            {t('hone.auth.code_expired')}
          </p>
        )}
        {phase.kind === 'error' && (
          <p
            role="alert"
            style={{
              marginTop: 18,
              display: 'inline-flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 11,
              color: 'var(--red)',
              maxWidth: '60ch',
              textAlign: 'left',
              fontFamily: monoFont,
              letterSpacing: '0.08em',
            }}
          >
            <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: 1.5, background: 'var(--red)', marginTop: 6, flex: '0 0 auto' }} />
            <span>{phase.message}</span>
          </p>
        )}

        {/* Dev login bypass — visible only в development build. INSECURE,
         * требует backend DEV_AUTH=true. Hidden в prod automated by
         * import.meta.env.DEV gate. */}
        {import.meta.env.DEV && (
          <div
            style={{
              marginTop: 44,
              paddingTop: 22,
              borderTop: '1px dashed var(--hair-2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                ...captionMonoSmall,
                fontSize: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: 1.5, background: 'var(--red)' }} />
              {t('hone.auth.dev.eyebrow')}
            </div>
            <div className="flex-wrap-row" style={{ gap: 10, alignItems: 'baseline', justifyContent: 'center' }}>
              <input
                type="text"
                value={devUsername}
                onChange={(e) => setDevUsername(e.target.value)}
                placeholder={t('hone.auth.dev.username_placeholder')}
                disabled={devBusy}
                aria-label={t('hone.auth.dev.label')}
                className="focus-ring min-w-0"
                style={{
                  flex: '0 1 160px',
                  minWidth: 0,
                  padding: '6px 0',
                  background: 'transparent',
                  border: 0,
                  borderBottom: '1px solid var(--hair-2)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  transition: 'border-color var(--motion-dur-small) var(--motion-ease-decelerate)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'var(--ink)')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'var(--hair-2)')}
              />
              <button
                onClick={() => void devLogin()}
                disabled={devBusy || !devUsername.trim()}
                className="focus-ring motion-press"
                style={{
                  padding: '7px 16px',
                  background: 'var(--ink)',
                  color: 'var(--bg)',
                  border: 0,
                  borderRadius: 'var(--radius-inner)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: devBusy || !devUsername.trim() ? 'not-allowed' : 'pointer',
                  opacity: devBusy || !devUsername.trim() ? 0.5 : 1,
                  transition:
                    'background-color var(--motion-dur-small) var(--motion-ease-standard), opacity var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
                }}
              >
                {devBusy ? t('hone.auth.dev.busy') : t('hone.auth.dev.cta')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AwaitingPanel({ flow, onCancel }: { flow: TelegramStart; onCancel: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  // Pollloop успешно log-in'нул юзера → AwaitingPanel unmount'нется,
  // pending setCopied(false) сработал бы на dead component. Ref + cleanup.
  const copiedTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    };
  }, []);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(flow.code);
      setCopied(true);
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
      }
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        setCopied(false);
      }, 1500);
    } catch {
      /* clipboard может быть недоступен */
    }
  };
  const onReopenBot = async () => {
    await window.hone?.shell.openExternal(flow.deepLink);
  };
  return (
    <div style={{ marginTop: 32 }}>
      <div
        className="flex-wrap-row"
        style={{
          padding: '14px 18px',
          background: 'transparent',
          border: '1px solid var(--hair-2)',
          borderRadius: 'var(--radius-inner)',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div style={{ ...captionMonoTiny }}>{t('hone.auth.code_label')}</div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: 'var(--ink)',
              marginTop: 4,
            }}
          >
            {flow.code}
          </div>
        </div>
        <button
          onClick={() => void onCopy()}
          className="focus-ring motion-press"
          style={{
            ...captionMonoSmall,
            padding: '6px 14px',
            color: copied ? 'var(--ink)' : 'var(--ink-60)',
            border: '1px solid var(--hair-2)',
            borderRadius: 999,
            background: 'transparent',
            cursor: 'pointer',
            transition:
              'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
          }}
        >
          {copied ? t('hone.auth.cta.copied') : t('hone.auth.cta.copy')}
        </button>
      </div>
      <p
        style={{
          marginTop: 16,
          fontSize: 13,
          color: 'var(--ink-60)',
          lineHeight: 1.55,
          textAlign: 'left',
        }}
      >
        {t('hone.auth.bot_open_again_pre')}
        <button
          onClick={() => void onReopenBot()}
          className="focus-ring"
          style={{
            color: 'var(--ink)',
            textDecoration: 'underline',
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            fontSize: 'inherit',
            fontFamily: 'inherit',
          }}
        >
          {t('hone.auth.bot_open_again_link')}
        </button>
        {t('hone.auth.bot_open_again_post')}
      </p>
      <p
        style={{
          marginTop: 14,
          ...captionMonoSmall,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span aria-hidden="true" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 999, background: 'var(--red)' }} />
        {t('hone.auth.waiting')}
      </p>
      <div>
        <button
          onClick={onCancel}
          className="focus-ring motion-press"
          style={{
            ...captionMonoSmall,
            marginTop: 16,
            padding: '6px 14px',
            background: 'transparent',
            border: '1px solid var(--hair)',
            borderRadius: 'var(--radius-inner)',
            cursor: 'pointer',
            transition: 'color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard)',
          }}
        >
          {t('hone.auth.cta.cancel')}
        </button>
      </div>
    </div>
  );
}

// ── tokens ──────────────────────────────────────────────────────────────

const monoFont = "'JetBrains Mono', ui-monospace, monospace";

const captionMonoSmall: React.CSSProperties = {
  fontFamily: monoFont,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};

const captionMonoTiny: React.CSSProperties = {
  fontFamily: monoFont,
  fontSize: 9,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};
