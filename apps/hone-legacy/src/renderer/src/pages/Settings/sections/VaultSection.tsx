import { useCallback, useEffect, useState } from 'react';

import { useT } from '@d9-i18n';

import {
  initVault,
  unlockVault,
  lockVault,
  isUnlocked,
  subscribe as subscribeVault,
  fetchSalt,
} from '../../../api/vault';
import { LockIcon, LockGlyph } from '../vault/LockIcon';
import { VaultButton, VaultStatusBadge } from '../vault/VaultButton';
import { VaultPasswordForm } from '../vault/VaultPasswordForm';

const loadingStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-40)' };
const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 };

const explainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 14,
  padding: '14px 16px',
  borderRadius: 12,
  background: 'rgb(var(--ink-rgb) / 0.03)',
  border: '1px solid var(--ink-10)',
};

const explainerIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  flexShrink: 0,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 10,
  background: 'var(--ink-tint-04)',
  color: 'var(--ink-60)',
};

const explainerBodyStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  color: 'var(--ink-90)',
  lineHeight: 1.55,
};

const explainerHeadStyle: React.CSSProperties = { marginBottom: 4, color: 'var(--ink)' };
const explainerTextStyle: React.CSSProperties = { color: 'var(--ink-60)' };

const ctrlRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };
const errorStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--red)' };
const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ink-40)',
  lineHeight: 1.55,
};

type VaultState = 'unknown' | 'none' | 'locked' | 'unlocked';

// persistPassphraseSilently — сохраняем passphrase в OS keychain через
// preload bridge. Безопасный no-op если safeStorage недоступен — юзер
// просто введёт passphrase следующий раз.
async function persistPassphraseSilently(pass: string): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.hone : undefined;
  if (!bridge?.vault) return;
  try {
    await bridge.vault.passSave(pass);
  } catch {
    /* ignore */
  }
}

// VaultSection — Private Vault status + setup / unlock / lock controls.
// Three states:
//   1. Not initialised: «Set up Vault» button → POST /vault/init + prompt
//      password → unlockVault() → store key in memory.
//   2. Initialised + locked: «Unlock» button → password prompt →
//      unlockVault() (re-derive same key from same salt).
//   3. Initialised + unlocked: «Lock now» button + status badge.
export function VaultSection() {
  const t = useT();
  // 'unknown' пока не определили (initial fetchSalt), 'none' = не initialised,
  // 'locked' = initialised но not unlocked, 'unlocked' = ready.
  const [state, setState] = useState<VaultState>('unknown');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Inline password inputs. window.prompt() в Electron renderer возвращает
  // NULL без показа диалога (Chromium блокирует prompt по дефолту в Electron),
  // поэтому раньше клик Unlock молча ничего не делал.
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [showUnlockForm, setShowUnlockForm] = useState(false);

  // Sync with vault module state on subscribe.
  useEffect(() => {
    let live = true;
    const refresh = async () => {
      if (!live) return;
      if (isUnlocked()) {
        setState('unlocked');
        return;
      }
      try {
        const salt = await fetchSalt();
        if (!live) return;
        setState(salt ? 'locked' : 'none');
      } catch {
        if (!live) return;
        setState('locked'); // network blip — assume initialised
      }
    };
    void refresh();
    const unsub = subscribeVault((unlocked) => {
      if (!live) return;
      if (unlocked) setState('unlocked');
      else void refresh();
    });
    return () => {
      live = false;
      unsub();
    };
  }, []);

  const resetForms = useCallback(() => {
    setPwd1('');
    setPwd2('');
    setShowSetupForm(false);
    setShowUnlockForm(false);
    setError(null);
  }, []);

  const onSetUp = useCallback(async () => {
    setError(null);
    if (pwd1.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (pwd1 !== pwd2) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await initVault();
      await unlockVault(pwd1);
      await persistPassphraseSilently(pwd1);
      resetForms();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [pwd1, pwd2, resetForms]);

  const onUnlock = useCallback(async () => {
    setError(null);
    if (!pwd1) {
      setError('Enter your Vault password');
      return;
    }
    setBusy(true);
    try {
      await unlockVault(pwd1);
      // КРИТИЧНО: persist в Keychain ПОСЛЕ unlock — иначе следующий restart
      // снова попросит password.
      await persistPassphraseSilently(pwd1);
      resetForms();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Wrong password or vault corrupted: ${msg}`);
    } finally {
      setBusy(false);
    }
  }, [pwd1, resetForms]);

  const onLock = useCallback(() => {
    lockVault();
    // Очищаем сохранённый passphrase из keychain — иначе при следующем
    // launch'е VaultUnlockGate auto-unlock'нет. Юзер явно сказал Lock —
    // уважаем намерение.
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (bridge?.vault) {
      void bridge.vault.passClear().catch(() => {
        /* ignore */
      });
    }
  }, []);

  const onShowSetup = useCallback(() => setShowSetupForm(true), []);
  const onShowUnlock = useCallback(() => setShowUnlockForm(true), []);
  const onPwd2Noop = useCallback(() => undefined, []);

  if (state === 'unknown') {
    return <div style={loadingStyle}>{t('common.loading')}</div>;
  }

  return (
    <div style={wrapStyle}>
      {/* Большой объясняющий блок — что такое vault и зачем lock-icon
          в Notes. Юзер не должен идти в документацию чтобы понять. */}
      <div style={explainerStyle}>
        <div style={explainerIconStyle}>
          <LockIcon size={18} />
        </div>
        <div style={explainerBodyStyle}>
          <div style={explainerHeadStyle}>How encryption works</div>
          <div style={explainerTextStyle}>
            Once Vault is set up, every note in the sidebar gets a small{' '}
            <LockGlyph /> icon next to its three-dots menu. Click it on a sensitive
            note to encrypt the body before it reaches our servers. Encrypted notes
            stay readable to you on any of your devices (when Vault is unlocked),
            but invisible to search and publish-to-web.
          </div>
        </div>
      </div>

      <div style={ctrlRowStyle}>
        <VaultStatusBadge state={state} />
        {state === 'none' && !showSetupForm && (
          <VaultButton onClick={onShowSetup} disabled={busy} primary>
            Set up Vault
          </VaultButton>
        )}
        {state === 'locked' && !showUnlockForm && (
          <VaultButton onClick={onShowUnlock} disabled={busy} primary>
            Unlock
          </VaultButton>
        )}
        {state === 'unlocked' && (
          <VaultButton onClick={onLock} disabled={busy}>
            Lock now
          </VaultButton>
        )}
      </div>

      {/* Inline setup form — replaces window.prompt (broken in Electron).
          Two password fields: confirm + visible/hidden via type=password. */}
      {state === 'none' && showSetupForm && (
        <VaultPasswordForm
          mode="setup"
          pwd1={pwd1}
          pwd2={pwd2}
          onPwd1Change={setPwd1}
          onPwd2Change={setPwd2}
          onSubmit={onSetUp}
          onCancel={resetForms}
          busy={busy}
        />
      )}
      {state === 'locked' && showUnlockForm && (
        <VaultPasswordForm
          mode="unlock"
          pwd1={pwd1}
          pwd2=""
          onPwd1Change={setPwd1}
          onPwd2Change={onPwd2Noop}
          onSubmit={onUnlock}
          onCancel={resetForms}
          busy={busy}
        />
      )}
      {error ? (
        <div style={errorStyle}>{error}</div>
      ) : (
        <div style={hintStyle}>
          {state === 'none' && 'After setup, lock icons appear next to each note in the sidebar.'}
          {state === 'locked' && 'Vault is set up. Unlock with your password to read or encrypt notes.'}
          {state === 'unlocked' && 'Vault unlocked for this session. Auto-locks on close, sign-out, or app reload.'}
        </div>
      )}
    </div>
  );
}
