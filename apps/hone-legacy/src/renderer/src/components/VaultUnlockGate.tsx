// VaultUnlockGate — gate-component: при mount'е проверяет состояние vault'а,
// и если требуется (vault уже инициализирован server-side, но локально
// derivedKey не unlocked) — показывает passphrase prompt. После unlock'а
// рендерит children. Если vault ещё не initialised — show «Set up vault»
// flow с двумя prompt'ами (set + confirm passphrase).
//
// Используется как обёртка вокруг Notes (в App.tsx) — по политике пользователя
// notes по дефолту E2E-encrypted, поэтому без unlocked vault'а notes
// бесполезны.
//
// Архитектура крипто:
//   - Salt — server-side в vault_metadata.user_salt (per-user). Init создаёт
//     random salt, encrypts тестовый-block (ниже) для проверки future
//     unlock'ов.
//   - PBKDF2-SHA256 200k iter (см. api/vault.ts) → AES-256-GCM key.
//   - Key cached в module memory (не в localStorage) — при перезагрузке
//     приложения требуется повторный ввод. Это intended для secrecy: даже
//     если у злоумышленника физический доступ к ноуту с running'ed app,
//     после lock he нужен passphrase снова.

import { useEffect, useState } from 'react';

import { useT } from '@d9-i18n';

import { fetchSalt, initVault, isUnlocked, unlockVault, subscribe } from '../api/vault';

interface VaultUnlockGateProps {
  /** Children рендерятся ТОЛЬКО когда vault unlocked. */
  children: React.ReactNode;
}

type GateState =
  | { kind: 'loading' }
  | { kind: 'unlocked' }
  | { kind: 'needs-init' } // server salt пустой, нужен first-time setup
  | { kind: 'needs-unlock' } // salt есть, нужен ввод passphrase
  | { kind: 'failed'; message: string }; // probe не получился — offline / 401 / 500

export function VaultUnlockGate({ children }: VaultUnlockGateProps) {
  const t = useT();
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [busy, setBusy] = useState(false);

  // Initial probe: есть ли salt server-side. Если есть И в OS keychain'е
  // сохранена passphrase (Electron safeStorage) — auto-unlock'аем
  // незаметно для юзера (как auth-сессия). Это убирает «вводить пароль на
  // каждом запуске» — раз ввёл, дальше TouchID/DPAPI делает за тебя.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (isUnlocked()) {
          if (!cancelled) setState({ kind: 'unlocked' });
          return;
        }
        const salt = await fetchSalt();
        if (cancelled) return;
        if (salt === null) {
          setState({ kind: 'needs-init' });
          return;
        }
        // Try silent unlock через OS keychain.
        const bridge = typeof window !== 'undefined' ? window.hone : undefined;
        if (bridge?.vault) {
          try {
            const saved = await bridge.vault.passLoad();
            if (!cancelled && saved) {
              await unlockVault(saved);
              if (!cancelled) setState({ kind: 'unlocked' });
              return;
            }
          } catch {
            // Saved passphrase больше не работает (vault был re-init или
            // OS keychain поменялся) — clear и попросить ручной ввод.
            try {
              await bridge.vault.passClear();
            } catch {
              /* ignore */
            }
          }
        }
        if (!cancelled) setState({ kind: 'needs-unlock' });
      } catch (e) {
        if (cancelled) return;
        // Probe failed — раньше state застревал в 'loading' навсегда
        // (юзер видел «Loading vault…» бесконечно). Скорее всего offline
        // или 401 (refresh не помог). Переходим в failed-состояние с
        // понятным сообщением + кнопкой retry.
        const msg = (e instanceof Error ? e.message : '') || t('hone.vault.err.unreachable');
        setError(msg);
        setState({ kind: 'failed', message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Подписываемся на vault subscribe — если другой component сделает
  // unlock/lock, обновим UI.
  useEffect(() => {
    const unsub = subscribe((u) => {
      setState(u ? { kind: 'unlocked' } : { kind: 'needs-unlock' });
    });
    return unsub;
  }, []);

  if (state.kind === 'loading') {
    return <CenterMsg text={t('hone.vault.loading')} />;
  }
  if (state.kind === 'unlocked') {
    return <>{children}</>;
  }
  if (state.kind === 'failed') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: 32,
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            color: 'var(--red)',
            textTransform: 'uppercase',
          }}
        >
          {t('hone.vault.eyebrow.offline')}
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            textAlign: 'center',
          }}
        >
          {t('hone.vault.offline.headline')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: 'var(--ink-60)',
            maxWidth: 420,
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          {t('hone.vault.offline.body')}
        </p>
        <p
          className="mono"
          style={{
            margin: 0,
            fontSize: 10,
            color: 'var(--ink-40)',
            letterSpacing: '0.08em',
            maxWidth: 420,
            textAlign: 'center',
            wordBreak: 'break-all',
          }}
        >
          {state.message}
        </p>
        <button
          onClick={() => {
            setError(null);
            setState({ kind: 'loading' });
            // Re-trigger probe via state-bump → useEffect re-mount won't
            // re-run без deps change'а. Простой workaround: window.location
            // reload не нужен — лучше явно re-call'нуть. Поскольку effect
            // зависит от [], re-run возможно только через unmount-mount
            // или ручной trigger. Делаем via external state bump:
            void (async () => {
              try {
                if (isUnlocked()) {
                  setState({ kind: 'unlocked' });
                  return;
                }
                const salt = await fetchSalt();
                if (salt === null) {
                  setState({ kind: 'needs-init' });
                  return;
                }
                const bridge = typeof window !== 'undefined' ? window.hone : undefined;
                if (bridge?.vault) {
                  try {
                    const saved = await bridge.vault.passLoad();
                    if (saved) {
                      await unlockVault(saved);
                      setState({ kind: 'unlocked' });
                      return;
                    }
                  } catch {
                    /* ignore */
                  }
                }
                setState({ kind: 'needs-unlock' });
              } catch (e) {
                const m = (e instanceof Error ? e.message : '') || t('hone.vault.err.still_unreachable');
                setState({ kind: 'failed', message: m });
              }
            })();
          }}
          style={{
            marginTop: 6,
            padding: '10px 22px',
            borderRadius: 999,
            background: '#fff',
            color: '#000',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {t('hone.vault.cta.retry')}
        </button>
      </div>
    );
  }

  // persistPassphraseSilently — сохраняет в OS keychain через preload bridge.
  // Ошибки swallow'аем — degraded UX (юзер введёт passphrase в следующий
  // раз) лучше fail-loud.
  const persistPassphraseSilently = async (pass: string) => {
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (!bridge?.vault) return;
    try {
      await bridge.vault.passSave(pass);
    } catch {
      /* ignore */
    }
  };

  const handleSetup = async () => {
    setError(null);
    if (pwd1.length < 8) {
      setError(t('hone.vault.err.short_passphrase'));
      return;
    }
    if (pwd1 !== pwd2) {
      setError(t('hone.vault.err.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await initVault();
      await unlockVault(pwd1);
      await persistPassphraseSilently(pwd1);
      setState({ kind: 'unlocked' });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    setError(null);
    if (!pwd1) {
      setError(t('hone.vault.err.empty'));
      return;
    }
    setBusy(true);
    try {
      await unlockVault(pwd1);
      await persistPassphraseSilently(pwd1);
      setState({ kind: 'unlocked' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(t('hone.vault.err.wrong_or_corrupt', { msg }));
    } finally {
      setBusy(false);
    }
  };

  // Generate — random 24-char base32-ish passphrase. base32 alphabet выбран
  // потому что entropy высокая (5 бит/char × 24 = 120 бит), но он human-
  // friendly: нет похожих 0/O, 1/l/I, юзер может прочитать вслух / записать
  // на бумажку. Strength: equivalent примерно AES-128 (резерв запасной).
  const handleGenerate = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 символа без 0/O/1/l/I
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < bytes.length; i++) {
      out += alphabet[bytes[i]! % alphabet.length];
      if (i % 4 === 3 && i < bytes.length - 1) out += '-';
    }
    setPwd1(out);
    setPwd2(out);
  };

  return (
    <div
      className="fadein"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 32,
        background: 'var(--bg)',
        animationDuration: 'var(--motion-dur-small)',
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          color: 'var(--ink-40)',
          textTransform: 'uppercase',
        }}
      >
        {state.kind === 'needs-init'
          ? t('hone.vault.eyebrow.first_setup')
          : t('hone.vault.eyebrow.locked')}
      </div>
      <h1
        style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          textAlign: 'center',
        }}
      >
        {state.kind === 'needs-init'
          ? t('hone.vault.setup.headline')
          : t('hone.vault.unlock.headline')}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          color: 'var(--ink-60)',
          maxWidth: 440,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        {state.kind === 'needs-init' ? (
          <>
            {t('hone.vault.setup.body_pre')}
            <strong>{t('hone.vault.setup.body_strong')}</strong>
          </>
        ) : (
          <>{t('hone.vault.unlock.body')}</>
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (state.kind === 'needs-init') void handleSetup();
          else void handleUnlock();
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
          maxWidth: 360,
          marginTop: 6,
        }}
      >
        <input
          type="password"
          autoFocus
          value={pwd1}
          onChange={(e) => setPwd1(e.target.value)}
          placeholder={t('hone.vault.input.passphrase')}
          disabled={busy}
          style={{
            padding: '12px 14px',
            fontSize: 14,
            background: 'rgb(var(--ink-rgb) / 0.05)',
            border: '1px solid rgb(var(--ink-rgb) / 0.1)',
            borderRadius: 8,
            color: 'var(--ink)',
            outline: 'none',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        />
        {state.kind === 'needs-init' && (
          <>
            <input
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              placeholder={t('hone.vault.input.confirm')}
              disabled={busy}
              style={{
                padding: '12px 14px',
                fontSize: 14,
                background: 'rgb(var(--ink-rgb) / 0.05)',
                border: '1px solid rgb(var(--ink-rgb) / 0.1)',
                borderRadius: 8,
                color: 'var(--ink)',
                outline: 'none',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              style={{
                alignSelf: 'flex-start',
                padding: '6px 12px',
                fontSize: 11,
                letterSpacing: '0.08em',
                color: 'var(--ink-60)',
                background: 'rgb(var(--ink-rgb) / 0.05)',
                border: '1px solid var(--ink-tint-08)',
                borderRadius: 6,
                cursor: busy ? 'default' : 'pointer',
                fontFamily: 'var(--font-mono, monospace)',
                transition: 'color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard)',
              }}
              onMouseEnter={(e) => {
                if (busy) return;
                e.currentTarget.style.color = 'var(--ink)';
                e.currentTarget.style.background = 'var(--ink-tint-08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--ink-60)';
                e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)';
              }}
            >
              {t('hone.vault.generate')}
            </button>
            {pwd1.length > 0 && pwd1 === pwd2 && (
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  color: 'var(--ink-40)',
                  padding: '4px 0',
                  wordBreak: 'break-all',
                  textAlign: 'center',
                }}
              >
                {pwd1}
                <div style={{ marginTop: 4, color: 'var(--red)', fontSize: 9 }}>
                  {t('hone.vault.generate.warning')}
                </div>
              </div>
            )}
          </>
        )}
        {error && (
          <div
            className="mono"
            style={{ fontSize: 11, color: 'var(--red)', letterSpacing: '0.08em', textAlign: 'center' }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            padding: '11px 20px',
            borderRadius: 999,
            background: busy ? 'rgb(var(--ink-rgb) / 0.1)' : '#fff',
            color: busy ? 'rgb(var(--ink-rgb) / 0.4)' : '#000',
            border: 'none',
            cursor: busy ? 'default' : 'pointer',
            fontSize: 13.5,
            fontWeight: 500,
            transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
          }}
        >
          {busy
            ? t('hone.vault.cta.working')
            : state.kind === 'needs-init'
              ? t('hone.vault.cta.create')
              : t('hone.vault.cta.unlock')}
        </button>
      </form>
      <div
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.08em',
          color: 'var(--ink-40)',
          textTransform: 'uppercase',
          marginTop: 14,
        }}
      >
        {t('hone.vault.eyebrow.footer')}
      </div>
    </div>
  );
}

function CenterMsg({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-40)',
        fontSize: 12,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {text}
    </div>
  );
}
